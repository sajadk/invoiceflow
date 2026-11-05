<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin \App\Models\Payment
 */
class PaymentResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'amount' => $this->amount, // fils
            'paid_on' => $this->paid_on->toDateString(),
            'method' => $this->method->value,
            'method_label' => $this->method->label(),
            'reference' => $this->reference,
            'notes' => $this->notes,
            // Only on the payments list, where each row needs to link back to its invoice.
            'invoice' => $this->whenLoaded('invoice', fn () => [
                'id' => $this->invoice->id,
                'number' => $this->invoice->number,
                'customer_name' => $this->invoice->billed_to['name'] ?? $this->invoice->customer?->name,
            ]),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
