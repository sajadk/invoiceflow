<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin \App\Models\Bill
 */
class BillResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'supplier_name' => $this->supplier_name,
            'supplier_trn' => $this->supplier_trn,
            'supplier_invoice_number' => $this->supplier_invoice_number,
            'status' => $this->status->value,
            'display_status' => $this->displayStatus(),
            'is_overdue' => $this->isOverdue(),
            'issue_date' => $this->issue_date->toDateString(),
            'due_date' => $this->due_date?->toDateString(),
            'currency' => $this->currency,
            'subtotal' => $this->subtotal,
            'vat_total' => $this->vat_total,
            'total' => $this->total,
            'notes' => $this->notes,
            // Same shape as invoice items, so the frontend reuses its line-item types.
            'items' => InvoiceItemResource::collection($this->whenLoaded('items')),
            'vat_breakdown' => $this->whenLoaded('items', fn () => array_values($this->vatBreakdown())),
            'paid_at' => $this->paid_at?->toIso8601String(),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
