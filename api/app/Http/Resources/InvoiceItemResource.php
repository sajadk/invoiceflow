<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin \App\Models\InvoiceItem
 */
class InvoiceItemResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'position' => $this->position,
            'description' => $this->description,
            'quantity' => $this->quantity,      // "1.500"
            'unit_price' => $this->unit_price,  // fils
            'vat_rate' => $this->vat_rate->value,
            'line_total' => $this->line_total,  // fils, excl. VAT
        ];
    }
}
