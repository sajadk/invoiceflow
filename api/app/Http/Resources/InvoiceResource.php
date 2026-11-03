<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin \App\Models\Invoice
 */
class InvoiceResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'number' => $this->number,
            'status' => $this->status->value,
            'display_status' => $this->displayStatus(),
            'is_overdue' => $this->isOverdue(),
            'issue_date' => $this->issue_date->toDateString(),
            'due_date' => $this->due_date->toDateString(),
            'currency' => $this->currency,
            'subtotal' => $this->subtotal,
            'vat_total' => $this->vat_total,
            'total' => $this->total,
            'amount_paid' => $this->amount_paid,
            'balance_due' => $this->balanceDue(),
            'notes' => $this->notes,
            'billed_to' => $this->billed_to,
            'customer' => new CustomerResource($this->whenLoaded('customer')),
            'items' => InvoiceItemResource::collection($this->whenLoaded('items')),
            'payments' => PaymentResource::collection($this->whenLoaded('payments')),
            'vat_breakdown' => $this->whenLoaded('items', fn () => array_values($this->vatBreakdown())),
            'sent_at' => $this->sent_at?->toIso8601String(),
            'paid_at' => $this->paid_at?->toIso8601String(),
            'voided_at' => $this->voided_at?->toIso8601String(),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
