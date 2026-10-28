<?php

namespace App\Http\Controllers\Api;

use App\Enums\Emirate;
use App\Http\Controllers\Controller;
use App\Http\Requests\Customers\CustomerRequest;
use App\Http\Resources\CustomerResource;
use App\Models\Customer;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

class CustomerController extends Controller
{
    private const SORTABLE = ['name', 'created_at'];

    /**
     * GET /api/customers?search=&emirate=&sort=-created_at&page=2&per_page=10
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'emirate' => ['nullable', Rule::enum(Emirate::class)],
            'sort' => ['nullable', Rule::in([...self::SORTABLE, ...array_map(fn ($c) => "-{$c}", self::SORTABLE)])],
            'per_page' => ['nullable', 'integer', 'min:5', 'max:100'],
        ]);

        $sort = $filters['sort'] ?? 'name';
        $direction = str_starts_with($sort, '-') ? 'desc' : 'asc';

        $customers = Customer::query()
            ->whereBelongsTo($request->user())
            ->when($filters['search'] ?? null, function (Builder $query, string $search) {
                $term = '%'.addcslashes($search, '%_\\').'%';
                $query->where(fn (Builder $q) => $q
                    ->where('name', 'like', $term)
                    ->orWhere('email', 'like', $term)
                    ->orWhere('trn', 'like', $term));
            })
            ->when($filters['emirate'] ?? null, fn (Builder $query, string $emirate) => $query->where('emirate', $emirate))
            ->orderBy(ltrim($sort, '-'), $direction)
            ->orderBy('id', $direction) // stable order when names/dates tie
            ->paginate($filters['per_page'] ?? 10)
            ->withQueryString();

        return CustomerResource::collection($customers);
    }

    public function store(CustomerRequest $request): JsonResponse
    {
        $customer = new Customer($request->validated());
        $customer->user()->associate($request->user());
        $customer->save();

        return (new CustomerResource($customer))
            ->response()
            ->setStatusCode(201);
    }

    public function show(Customer $customer): CustomerResource
    {
        Gate::authorize('view', $customer);

        return new CustomerResource($customer);
    }

    public function update(CustomerRequest $request, Customer $customer): CustomerResource
    {
        $customer->update($request->validated());

        return new CustomerResource($customer);
    }

    public function destroy(Customer $customer): Response
    {
        Gate::authorize('delete', $customer);

        $customer->delete();

        return response()->noContent();
    }
}
