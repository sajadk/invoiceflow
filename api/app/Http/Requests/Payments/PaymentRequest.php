<?php

namespace App\Http\Requests\Payments;

use App\Enums\PaymentMethod;
use App\Http\Requests\Invoices\InvoiceRequest;
use App\Models\Invoice;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

/**
 * POST /api/invoices/{invoice}/payments. Amount is integer fils.
 * The "not more than the balance" check runs in RecordPayment, under a row lock.
 */
class PaymentRequest extends FormRequest
{
    public function authorize(): bool
    {
        $invoice = $this->invoice();
        Gate::authorize('update', $invoice);
        $invoice->ensureCanReceivePayment(); // 409 before validating

        return true;
    }

    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        return [
            'amount' => ['required', 'integer', 'min:1', 'max:'.InvoiceRequest::MAX_UNIT_PRICE * 100],
            'paid_on' => [
                'required',
                'date_format:Y-m-d',
                'before_or_equal:today',
                'after_or_equal:'.$this->invoice()->issue_date->toDateString(),
            ],
            'method' => ['required', Rule::enum(PaymentMethod::class)],
            'reference' => ['nullable', 'string', 'max:100'],
            'notes' => ['nullable', 'string', 'max:500'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'amount.min' => 'Enter an amount above 0.',
            'paid_on.before_or_equal' => 'The payment date can’t be in the future.',
            'paid_on.after_or_equal' => 'The payment date can’t be before the invoice date.',
        ];
    }

    private function invoice(): Invoice
    {
        /** @var Invoice */
        return $this->route('invoice');
    }
}
