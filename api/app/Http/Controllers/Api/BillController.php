<?php

namespace App\Http\Controllers\Api;

use App\Actions\Bills\SaveBill;
use App\Http\Controllers\Controller;
use App\Http\Requests\Bills\BillRequest;
use App\Http\Resources\BillResource;
use App\Models\Bill;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

class BillController extends Controller
{
    private const SORTABLE = ['issue_date', 'due_date', 'total'];

    /**
     * GET /api/bills?status=overdue&search=&sort=-issue_date&page=
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $filters = $request->validate([
            'status' => ['nullable', Rule::in(['unpaid', 'paid', 'overdue'])],
            'search' => ['nullable', 'string', 'max:100'],
            'sort' => ['nullable', Rule::in([...self::SORTABLE, ...array_map(fn ($c) => "-{$c}", self::SORTABLE)])],
            'per_page' => ['nullable', 'integer', 'min:5', 'max:100'],
        ]);

        $sort = $filters['sort'] ?? '-issue_date';
        $direction = str_starts_with($sort, '-') ? 'desc' : 'asc';

        $bills = Bill::query()
            ->whereBelongsTo($request->user())
            ->when($filters['status'] ?? null, fn (Builder $query, string $status) => match ($status) {
                'overdue' => $query->overdue(),
                default => $query->where('status', $status),
            })
            ->when($filters['search'] ?? null, function (Builder $query, string $search) {
                $term = '%'.addcslashes($search, '%_\\').'%';
                $query->where(fn (Builder $q) => $q
                    ->where('supplier_name', 'like', $term)
                    ->orWhere('supplier_invoice_number', 'like', $term)
                    ->orWhere('supplier_trn', 'like', $term));
            })
            ->orderBy(ltrim($sort, '-'), $direction)
            ->orderBy('id', $direction)
            ->paginate($filters['per_page'] ?? 10)
            ->withQueryString();

        return BillResource::collection($bills);
    }

    public function store(BillRequest $request, SaveBill $saveBill): JsonResponse
    {
        $bill = $saveBill->handle($request->user(), $request->validated());

        return (new BillResource($bill))->response()->setStatusCode(201);
    }

    public function show(Bill $bill): BillResource
    {
        Gate::authorize('view', $bill);

        return new BillResource($bill->load('items'));
    }

    public function update(BillRequest $request, Bill $bill, SaveBill $saveBill): BillResource
    {
        return new BillResource($saveBill->handle($request->user(), $request->validated(), $bill));
    }

    public function destroy(Bill $bill): Response
    {
        Gate::authorize('delete', $bill);
        $bill->ensureIsUnpaid('deleted');

        $bill->delete();

        return response()->noContent();
    }

    public function markPaid(Bill $bill): BillResource
    {
        Gate::authorize('update', $bill);
        $bill->markAsPaid();

        return new BillResource($bill->load('items'));
    }

    public function markUnpaid(Bill $bill): BillResource
    {
        Gate::authorize('update', $bill);
        $bill->markAsUnpaid();

        return new BillResource($bill->load('items'));
    }
}
