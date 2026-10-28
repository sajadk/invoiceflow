<?php

namespace App\Http\Requests\Customers;

use App\Enums\Emirate;
use App\Models\Customer;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

/**
 * Shared by store (POST /customers) and update (PUT /customers/{customer}).
 */
class CustomerRequest extends FormRequest
{
    public function authorize(): bool
    {
        // Check ownership before validating, so another user's customer is a 404,
        // never a 422 that would reveal it exists.
        if ($customer = $this->customer()) {
            Gate::authorize('update', $customer);
        }

        return true;
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            // People paste TRNs as "100-1234-5678-9012" or with spaces; store digits only.
            'trn' => $this->filled('trn') ? preg_replace('/\D/', '', (string) $this->input('trn')) : null,
            'email' => $this->filled('email') ? strtolower(trim((string) $this->input('email'))) : null,
        ]);
    }

    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'email' => ['nullable', 'string', 'email', 'max:255'],
            'phone' => ['nullable', 'string', 'max:30', 'regex:/^\+?[0-9\s\-()]{7,20}$/'],
            'trn' => [
                'nullable',
                'digits:15',
                'starts_with:100',
                // Unique per user, ignoring deleted customers and the one being edited.
                Rule::unique('customers', 'trn')
                    ->where('user_id', $this->user()->id)
                    ->whereNull('deleted_at')
                    ->ignore($this->customer()),
            ],
            'emirate' => ['nullable', Rule::enum(Emirate::class)],
            'address' => ['nullable', 'string', 'max:1000'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'trn.digits' => 'A TRN is exactly 15 digits.',
            'trn.starts_with' => 'UAE TRNs start with 100.',
            'trn.unique' => 'You already have a customer with this TRN.',
            'phone.regex' => 'Enter a valid phone number, e.g. +971 50 123 4567.',
        ];
    }

    private function customer(): ?Customer
    {
        $customer = $this->route('customer');

        return $customer instanceof Customer ? $customer : null;
    }
}
