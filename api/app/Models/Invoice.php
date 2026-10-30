<?php

namespace App\Models;

use App\Enums\InvoiceStatus;
use App\Exceptions\InvoiceStateException;
use App\Support\InvoiceCalculator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $user_id
 * @property int $customer_id
 * @property int|null $sequence
 * @property string|null $number
 * @property InvoiceStatus $status
 * @property Carbon $issue_date
 * @property Carbon $due_date
 * @property string $currency
 * @property int $subtotal
 * @property int $vat_total
 * @property int $total
 * @property array<string, mixed>|null $billed_to
 * @property string|null $notes
 * @property Carbon|null $sent_at
 * @property Carbon|null $paid_at
 * @property Carbon|null $voided_at
 */
class Invoice extends Model
{
    /** Status, number, totals and user_id are set by the app, never mass-assigned from input. */
    protected $fillable = [
        'customer_id',
        'issue_date',
        'due_date',
        'notes',
    ];

    protected $attributes = [
        'status' => 'draft',
        'currency' => 'AED',
        'subtotal' => 0,
        'vat_total' => 0,
        'total' => 0,
    ];

    protected function casts(): array
    {
        return [
            'status' => InvoiceStatus::class,
            'issue_date' => 'date',
            'due_date' => 'date',
            'billed_to' => 'array',
            'sequence' => 'integer',
            'subtotal' => 'integer',
            'vat_total' => 'integer',
            'total' => 'integer',
            'sent_at' => 'datetime',
            'paid_at' => 'datetime',
            'voided_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Includes soft-deleted customers: old invoices must still show who they were for.
     *
     * @return BelongsTo<Customer, $this>
     */
    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class)->withTrashed();
    }

    /** @return HasMany<InvoiceItem, $this> */
    public function items(): HasMany
    {
        return $this->hasMany(InvoiceItem::class)->orderBy('position');
    }

    /** Sent and past its due date (in the app timezone). */
    public function scopeOverdue(Builder $query): void
    {
        $query->where('status', InvoiceStatus::Sent)->whereDate('due_date', '<', today());
    }

    public function isOverdue(): bool
    {
        return $this->status === InvoiceStatus::Sent && $this->due_date->lt(today());
    }

    /** What the UI shows: the stored status, or "overdue". */
    public function displayStatus(): string
    {
        return $this->isOverdue() ? 'overdue' : $this->status->value;
    }

    /**
     * @return array<string, array{rate: string, label: string, percent: int, taxable: int, vat: int}>
     */
    public function vatBreakdown(): array
    {
        return InvoiceCalculator::totals($this->items->map(fn (InvoiceItem $item) => [
            'quantity' => $item->quantity,
            'unit_price' => $item->unit_price,
            'vat_rate' => $item->vat_rate,
        ]))['vat_breakdown'];
    }

    public function markAsPaid(): void
    {
        if ($this->status !== InvoiceStatus::Sent) {
            throw new InvoiceStateException('Only sent invoices can be marked as paid.');
        }

        $this->forceFill(['status' => InvoiceStatus::Paid, 'paid_at' => now()])->save();
    }

    public function markAsVoid(): void
    {
        if ($this->status !== InvoiceStatus::Sent) {
            throw new InvoiceStateException('Only sent, unpaid invoices can be voided. Delete drafts instead.');
        }

        $this->forceFill(['status' => InvoiceStatus::Void, 'voided_at' => now()])->save();
    }

    public function ensureIsDraft(string $action): void
    {
        if ($this->status !== InvoiceStatus::Draft) {
            throw new InvoiceStateException("Only draft invoices can be {$action}.");
        }
    }
}
