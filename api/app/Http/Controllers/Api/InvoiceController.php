<?php

namespace App\Http\Controllers\Api;

use App\Actions\Invoices\SaveDraftInvoice;
use App\Actions\Invoices\SendInvoice;
use App\Enums\InvoiceStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Invoices\InvoiceRequest;
use App\Http\Resources\InvoiceResource;
use App\Models\Invoice;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

class InvoiceController extends Controller
{
    private const SORTABLE = ['issue_date', 'due_date', 'total', 'number'];

    private const STATUS_FILTERS = ['draft', 'sent', 'overdue', 'paid', 'void'];

    /**
     * GET /api/invoices?status=overdue&search=&customer_id=&sort=-issue_date&page=
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $filters = $request->validate([
            'status' => ['nullable', Rule::in(self::STATUS_FILTERS)],
            'search' => ['nullable', 'string', 'max:100'],
            'customer_id' => ['nullable', 'integer'],
            'sort' => ['nullable', Rule::in([...self::SORTABLE, ...array_map(fn ($c) => "-{$c}", self::SORTABLE)])],
            'per_page' => ['nullable', 'integer', 'min:5', 'max:100'],
        ]);

        $sort = $filters['sort'] ?? '-issue_date';
        $direction = str_starts_with($sort, '-') ? 'desc' : 'asc';

        $invoices = Invoice::query()
            ->whereBelongsTo($request->user())
            ->with('customer')
            ->when($filters['status'] ?? null, fn (Builder $query, string $status) => match ($status) {
                'overdue' => $query->overdue(),
                default => $query->where('status', $status),
            })
            ->when($filters['customer_id'] ?? null, fn (Builder $query, int $id) => $query->where('customer_id', $id))
            ->when($filters['search'] ?? null, function (Builder $query, string $search) {
                $term = '%'.addcslashes($search, '%_\\').'%';
                $query->where(fn (Builder $q) => $q
                    ->where('number', 'like', $term)
                    ->orWhereHas('customer', fn (Builder $c) => $c->where('name', 'like', $term)));
            })
            ->orderBy(ltrim($sort, '-'), $direction)
            ->orderBy('id', $direction)
            ->paginate($filters['per_page'] ?? 10)
            ->withQueryString();

        return InvoiceResource::collection($invoices);
    }

    public function store(InvoiceRequest $request, SaveDraftInvoice $saveDraft): JsonResponse
    {
        $invoice = $saveDraft->handle($request->user(), $request->validated());

        return (new InvoiceResource($invoice))->response()->setStatusCode(201);
    }

    public function show(Invoice $invoice): InvoiceResource
    {
        Gate::authorize('view', $invoice);

        return new InvoiceResource($invoice->load(['customer', 'items']));
    }

    public function update(InvoiceRequest $request, Invoice $invoice, SaveDraftInvoice $saveDraft): InvoiceResource
    {
        return new InvoiceResource($saveDraft->handle($request->user(), $request->validated(), $invoice));
    }

    public function destroy(Invoice $invoice): Response
    {
        Gate::authorize('delete', $invoice);
        $invoice->ensureIsDraft('deleted');

        $invoice->delete();

        return response()->noContent();
    }

    public function send(Invoice $invoice, SendInvoice $sendInvoice): InvoiceResource
    {
        Gate::authorize('update', $invoice);

        return new InvoiceResource($sendInvoice->handle($invoice));
    }

    public function markPaid(Invoice $invoice): InvoiceResource
    {
        Gate::authorize('update', $invoice);
        $invoice->markAsPaid();

        return new InvoiceResource($invoice->load(['customer', 'items']));
    }

    public function void(Invoice $invoice): InvoiceResource
    {
        Gate::authorize('update', $invoice);
        $invoice->markAsVoid();

        return new InvoiceResource($invoice->load(['customer', 'items']));
    }

    public function pdf(Request $request, Invoice $invoice): Response
    {
        Gate::authorize('view', $invoice);
        $invoice->load(['customer', 'items']);

        $filename = ($invoice->number ?? 'draft-'.$invoice->id).'.pdf';

        return Pdf::loadView('pdf.invoice', [
            'invoice' => $invoice,
            'seller' => $request->user(),
            'isDraft' => $invoice->status === InvoiceStatus::Draft,
        ])
            ->setPaper('a4')
            ->download($filename);
    }
}
