<?php

namespace App\Http\Requests\Invoices;

use App\Http\Requests\Concerns\ValidatesLineItems;
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
    use ValidatesLineItems;

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
            ...$this->lineItemRules(),
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
            ...$this->lineItemMessages(),
        ];
    }

    private function invoice(): ?Invoice
    {
        $invoice = $this->route('invoice');

        return $invoice instanceof Invoice ? $invoice : null;
    }
}
