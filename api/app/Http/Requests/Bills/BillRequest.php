<?php

namespace App\Http\Requests\Bills;

use App\Http\Requests\Concerns\ValidatesLineItems;
use App\Models\Bill;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

/**
 * Shared by store (POST /bills) and update (PUT /bills/{bill}).
 */
class BillRequest extends FormRequest
{
    use ValidatesLineItems;

    public function authorize(): bool
    {
        if ($bill = $this->bill()) {
            Gate::authorize('update', $bill);
            $bill->ensureIsUnpaid('edited'); // 409 before validating
        }

        return true;
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'supplier_name' => trim((string) $this->input('supplier_name')),
            'supplier_invoice_number' => trim((string) $this->input('supplier_invoice_number')),
            // People paste TRNs with spaces or dashes; store digits only.
            'supplier_trn' => $this->filled('supplier_trn') ? preg_replace('/\D/', '', (string) $this->input('supplier_trn')) : null,
            'due_date' => $this->filled('due_date') ? $this->input('due_date') : null,
        ]);
    }

    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        return [
            'supplier_name' => ['required', 'string', 'max:255'],
            'supplier_trn' => ['nullable', 'digits:15', 'starts_with:100'],
            'supplier_invoice_number' => [
                'required',
                'string',
                'max:64',
                // The same supplier invoice recorded twice would claim its VAT twice.
                Rule::unique('bills', 'supplier_invoice_number')
                    ->where('user_id', $this->user()->id)
                    ->where('supplier_name', (string) $this->input('supplier_name'))
                    ->ignore($this->bill()),
            ],
            'issue_date' => ['required', 'date_format:Y-m-d', 'before_or_equal:today'],
            'due_date' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:issue_date'],
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
            'supplier_trn.digits' => 'A TRN is exactly 15 digits.',
            'supplier_trn.starts_with' => 'UAE TRNs start with 100.',
            'supplier_invoice_number.unique' => 'You’ve already recorded this invoice number from this supplier.',
            'issue_date.before_or_equal' => 'A bill can’t be dated in the future.',
            'due_date.after_or_equal' => 'The due date can’t be before the invoice date.',
            ...$this->lineItemMessages(),
        ];
    }

    private function bill(): ?Bill
    {
        $bill = $this->route('bill');

        return $bill instanceof Bill ? $bill : null;
    }
}
