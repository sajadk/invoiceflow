<?php

namespace App\Models\Concerns;

use App\Support\InvoiceCalculator;

/**
 * Shared by sales invoices and supplier bills: the per-rate VAT breakdown,
 * recomputed from the stored line items with the same calculator that set the totals.
 */
trait HasVatBreakdown
{
    /**
     * @return array<string, array{rate: string, label: string, percent: int, taxable: int, vat: int}>
     */
    public function vatBreakdown(): array
    {
        return InvoiceCalculator::totals($this->items->map(fn ($item) => [
            'quantity' => $item->quantity,
            'unit_price' => $item->unit_price,
            'vat_rate' => $item->vat_rate,
        ]))['vat_breakdown'];
    }
}
