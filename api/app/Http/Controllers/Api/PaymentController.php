<?php

namespace App\Http\Controllers\Api;

use App\Actions\Payments\DeletePayment;
use App\Actions\Payments\RecordPayment;
use App\Enums\PaymentMethod;
use App\Http\Controllers\Controller;
use App\Http\Requests\Payments\PaymentRequest;
use App\Http\Resources\InvoiceResource;
use App\Http\Resources\PaymentResource;
use App\Models\Invoice;
use App\Models\Payment;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

class PaymentController extends Controller
{
    private const SORTABLE = ['paid_on', 'amount'];

    /**
     * GET /api/payments?search=&method=&from=2026-01-01&to=2026-03-31&sort=-paid_on&page=
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'method' => ['nullable', Rule::enum(PaymentMethod::class)],
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:from'],
            'sort' => ['nullable', Rule::in([...self::SORTABLE, ...array_map(fn ($c) => "-{$c}", self::SORTABLE)])],
            'per_page' => ['nullable', 'integer', 'min:5', 'max:100'],
        ]);

        $sort = $filters['sort'] ?? '-paid_on';
        $direction = str_starts_with($sort, '-') ? 'desc' : 'asc';

        $payments = Payment::query()
            ->whereBelongsTo($request->user())
            ->with('invoice.customer')
            ->when($filters['method'] ?? null, fn (Builder $q, string $method) => $q->where('method', $method))
            ->when($filters['from'] ?? null, fn (Builder $q, string $from) => $q->whereDate('paid_on', '>=', $from))
            ->when($filters['to'] ?? null, fn (Builder $q, string $to) => $q->whereDate('paid_on', '<=', $to))
            ->when($filters['search'] ?? null, function (Builder $query, string $search) {
                $term = '%'.addcslashes($search, '%_\\').'%';
                $query->where(fn (Builder $q) => $q
                    ->where('reference', 'like', $term)
                    ->orWhereHas('invoice', fn (Builder $i) => $i
                        ->where('number', 'like', $term)
                        ->orWhereHas('customer', fn (Builder $c) => $c->where('name', 'like', $term))));
            })
            ->orderBy(ltrim($sort, '-'), $direction)
            ->orderBy('id', $direction)
            ->paginate($filters['per_page'] ?? 15)
            ->withQueryString();

        return PaymentResource::collection($payments);
    }

    /**
     * POST /api/invoices/{invoice}/payments
     * Returns the updated invoice (balance, status and payment list in one response).
     */
    public function store(PaymentRequest $request, Invoice $invoice, RecordPayment $recordPayment): JsonResponse
    {
        $recordPayment->handle($invoice, $request->validated());

        return (new InvoiceResource($invoice->refresh()->load(Invoice::DETAIL_RELATIONS)))
            ->response()
            ->setStatusCode(201);
    }

    /**
     * DELETE /api/payments/{payment}
     * Returns the updated invoice, for the same reason as store().
     */
    public function destroy(Payment $payment, DeletePayment $deletePayment): InvoiceResource
    {
        Gate::authorize('delete', $payment);

        $invoice = $deletePayment->handle($payment);

        return new InvoiceResource($invoice->load(Invoice::DETAIL_RELATIONS));
    }
}
