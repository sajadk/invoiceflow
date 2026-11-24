<?php

namespace App\Http\Requests\Concerns;

use App\Enums\VatRate;
use Illuminate\Validation\Rule;

/**
 * Line-item rules shared by sales invoices and supplier bills, so both are
 * validated (and later calculated) exactly the same way.
 */
trait ValidatesLineItems
{
    public const MAX_UNIT_PRICE = 99_999_999; // AED 999,999.99

    public const MAX_QUANTITY = 9999.999;

    /**
     * @return array<string, array<int, mixed>>
     */
    protected function lineItemRules(): array
    {
        return [
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
    protected function lineItemMessages(): array
    {
        return [
            'items.required' => 'Add at least one line item.',
            'items.min' => 'Add at least one line item.',
            'items.*.description.required' => 'Describe this item.',
            'items.*.quantity.gt' => 'Quantity must be more than 0.',
            'items.*.quantity.decimal' => 'Up to 3 decimal places.',
            'items.*.unit_price.max' => 'Unit price can’t exceed AED 999,999.99.',
        ];
    }
}
