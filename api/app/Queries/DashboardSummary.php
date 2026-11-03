<?php

namespace App\Queries;

use App\Enums\InvoiceStatus;
use App\Http\Resources\PaymentResource;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;

/**
 * Every number on the dashboard, calculated in SQL with GROUP BY rather than by
 * loading invoices into PHP, so it stays fast as the data grows.
 *
 * "Outstanding" = sent invoices only (fully paid ones have status paid,
 * drafts and voids are never owed). Balance = total - amount_paid.
 * Date maths uses today in the app timezone (Asia/Dubai), passed as a bound
 * parameter rather than MySQL's CURDATE(), so tests can freeze time.
 */
final class DashboardSummary
{
    private const AGING_BUCKETS = [
        'current' => 'Not yet due',
        '1_30' => '1–30 days',
        '31_60' => '31–60 days',
        '61_90' => '61–90 days',
        '90_plus' => '90+ days',
    ];

    private CarbonImmutable $today;

    public function __construct(private readonly User $user)
    {
        // today() uses the app timezone and respects Carbon::setTestNow() in tests.
        $this->today = today()->toImmutable();
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'currency' => 'AED',
            'as_of' => $this->today->toDateString(),
            'outstanding' => $this->balanceOf($this->unpaid()),
            'overdue' => $this->balanceOf($this->unpaid()->whereDate('due_date', '<', $this->today)),
            'collected' => [
                'this_month' => $this->collectedBetween($this->today->startOfMonth(), $this->today->endOfMonth()),
                'last_month' => $this->collectedBetween(
                    $this->today->subMonthNoOverflow()->startOfMonth(),
                    $this->today->subMonthNoOverflow()->endOfMonth(),
                ),
            ],
            'vat' => [
                'period' => sprintf('Q%d %d', $this->today->quarter, $this->today->year),
                'amount' => (int) $this->issued()
                    ->whereBetween('issue_date', [$this->today->startOfQuarter()->toDateString(), $this->today->endOfQuarter()->toDateString()])
                    ->sum('vat_total'),
            ],
            'monthly' => $this->monthly(),
            'aging' => $this->aging(),
            'top_debtors' => $this->topDebtors(),
            'recent_payments' => PaymentResource::collection(
                Payment::query()
                    ->whereBelongsTo($this->user)
                    ->with('invoice.customer')
                    ->latest('paid_on')
                    ->latest('id')
                    ->limit(5)
                    ->get()
            )->resolve($request),
        ];
    }

    /** @return Builder<Invoice> Sent and not yet fully paid. */
    private function unpaid(): Builder
    {
        return Invoice::query()->whereBelongsTo($this->user)->where('status', InvoiceStatus::Sent);
    }

    /** @return Builder<Invoice> Invoices that count as issued revenue (not drafts or voids). */
    private function issued(): Builder
    {
        return Invoice::query()
            ->whereBelongsTo($this->user)
            ->whereIn('status', [InvoiceStatus::Sent, InvoiceStatus::Paid]);
    }

    /**
     * @param  Builder<Invoice>  $query
     * @return array{count: int, amount: int}
     */
    private function balanceOf(Builder $query): array
    {
        $row = $query->toBase()
            ->selectRaw('COUNT(*) as count, COALESCE(SUM(total - amount_paid), 0) as amount')
            ->first();

        return ['count' => (int) $row->count, 'amount' => (int) $row->amount];
    }

    private function collectedBetween(CarbonImmutable $from, CarbonImmutable $to): int
    {
        return (int) Payment::query()
            ->whereBelongsTo($this->user)
            ->whereBetween('paid_on', [$from->toDateString(), $to->toDateString()])
            ->sum('amount');
    }

    /**
     * Last 12 months including this one: invoiced (by issue date) vs collected (by payment date).
     *
     * @return list<array{month: string, invoiced: int, collected: int}>
     */
    private function monthly(): array
    {
        $start = $this->today->startOfMonth()->subMonthsNoOverflow(11);

        $invoiced = $this->issued()
            ->toBase()
            ->whereDate('issue_date', '>=', $start)
            ->selectRaw("DATE_FORMAT(issue_date, '%Y-%m') as month, SUM(total) as amount")
            ->groupBy('month')
            ->pluck('amount', 'month');

        $collected = Payment::query()
            ->whereBelongsTo($this->user)
            ->toBase()
            ->whereDate('paid_on', '>=', $start)
            ->selectRaw("DATE_FORMAT(paid_on, '%Y-%m') as month, SUM(amount) as amount")
            ->groupBy('month')
            ->pluck('amount', 'month');

        return collect(range(0, 11))
            ->map(function (int $offset) use ($start, $invoiced, $collected) {
                $month = $start->addMonthsNoOverflow($offset)->format('Y-m');

                return [
                    'month' => $month,
                    'invoiced' => (int) ($invoiced[$month] ?? 0),
                    'collected' => (int) ($collected[$month] ?? 0),
                ];
            })
            ->all();
    }

    /**
     * Unpaid balances by how late they are: the receivables aging report accountants ask for.
     *
     * @return list<array{bucket: string, label: string, count: int, amount: int}>
     */
    private function aging(): array
    {
        $today = $this->today->toDateString();

        $rows = $this->unpaid()
            ->toBase()
            ->selectRaw(
                "CASE
                    WHEN due_date >= ? THEN 'current'
                    WHEN DATEDIFF(?, due_date) <= 30 THEN '1_30'
                    WHEN DATEDIFF(?, due_date) <= 60 THEN '31_60'
                    WHEN DATEDIFF(?, due_date) <= 90 THEN '61_90'
                    ELSE '90_plus'
                END as bucket,
                COUNT(*) as count,
                SUM(total - amount_paid) as amount",
                [$today, $today, $today, $today],
            )
            ->groupBy('bucket')
            ->get()
            ->keyBy('bucket');

        return collect(self::AGING_BUCKETS)
            ->map(fn (string $label, string $bucket) => [
                'bucket' => $bucket,
                'label' => $label,
                'count' => (int) ($rows[$bucket]->count ?? 0),
                'amount' => (int) ($rows[$bucket]->amount ?? 0),
            ])
            ->values()
            ->all();
    }

    /**
     * @return list<array{customer_id: int, name: string, amount: int, invoices: int}>
     */
    private function topDebtors(): array
    {
        return $this->unpaid()
            ->select('customer_id')
            ->selectRaw('SUM(total - amount_paid) as amount, COUNT(*) as invoices')
            ->groupBy('customer_id')
            ->orderByDesc('amount')
            ->limit(5)
            ->with('customer')
            ->get()
            ->map(fn (Invoice $row) => [
                'customer_id' => $row->customer_id,
                'name' => $row->customer->name,
                'amount' => (int) $row->getAttribute('amount'),
                'invoices' => (int) $row->getAttribute('invoices'),
            ])
            ->all();
    }
}
