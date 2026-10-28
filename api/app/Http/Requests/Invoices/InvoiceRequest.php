<?php

namespace App\Http\Requests\Invoices;

use App\Enums\VatRate;
use App\Models\Invoice;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

/**
 * Shared by store (POST /invoices) and update (PUT /invoices/{invoice}).
 * Money arrives as integer fils; quantities as decimals with up to 3 places.
 */
class InvoiceRequest extends FormRequest
{
    public const MAX_UNIT_PRICE = 99_999_999; // AED 999,999.99

    public const MAX_QUANTITY = 9999.999;

    public function authorize(): bool
    {
        if ($invoice = $this->invoice()) {
            Gate::authorize('update', $invoice);
            // Fail fast with 409 before validating a payload we'd refuse anyway.
            $invoice->ensureIsDraft('edited');
        }

        return true;
    }

    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        return [
            'customer_id' => [
                'required',
                'integer',
                // Must be one of *this* user's active customers.
                Rule::exists('customers', 'id')
                    ->where('user_id', $this->user()->id)
                    ->whereNull('deleted_at'),
            ],
            'issue_date' => ['required', 'date_format:Y-m-d'],
            'due_date' => ['required', 'date_format:Y-m-d', 'after_or_equal:issue_date'],
            'notes' => ['nullable', 'string', 'max:2000'],

            'items' => ['required', 'array', 'min:1', 'max:100'],
            'items.*.description' => ['required', 'string', 'max:500'],
            'items.*.quantity' => ['required', 'numeric', 'gt:0', 'max:'.self::MAX_QUANTITY, 'decimal:0,3'],
            'items.*.unit_price' => ['required', 'integer', 'min:0', 'max:'.self::MAX_UNIT_PRICE],
            'items.*.vat_rate' => ['required', Rule::enum(VatRate::class)],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'customer_id.exists' => 'Choose one of your customers.',
            'due_date.after_or_equal' => 'The due date can’t be before the issue date.',
            'items.required' => 'Add at least one line item.',
            'items.min' => 'Add at least one line item.',
            'items.*.description.required' => 'Describe this item.',
            'items.*.quantity.gt' => 'Quantity must be more than 0.',
            'items.*.quantity.decimal' => 'Up to 3 decimal places.',
            'items.*.unit_price.max' => 'Unit price can’t exceed AED 999,999.99.',
        ];
    }

    private function invoice(): ?Invoice
    {
        $invoice = $this->route('invoice');

        return $invoice instanceof Invoice ? $invoice : null;
    }
}
