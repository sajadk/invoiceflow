<?php

namespace App\Actions\Invoices;

use App\Enums\InvoiceStatus;
use App\Exceptions\InvoiceStateException;
use App\Models\Invoice;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Issues a draft: assigns the next invoice number, freezes the customer's
 * details onto the invoice, and locks it from further edits.
 */
final class SendInvoice
{
    public function handle(Invoice $invoice): Invoice
    {
        return DB::transaction(function () use ($invoice) {
            // Lock the owner's row so two invoices sent at the same moment can't
            // both read the same "last sequence" and get the same number.
            User::query()->whereKey($invoice->user_id)->lockForUpdate()->first();

            $invoice->refresh();
            $invoice->ensureIsDraft('sent');

            if ($invoice->items()->doesntExist()) {
                throw new InvoiceStateException('Add at least one line item before sending.');
            }

            $sequence = (int) Invoice::query()->where('user_id', $invoice->user_id)->max('sequence') + 1;
            $customer = $invoice->customer;

            $invoice->forceFill([
                'status' => InvoiceStatus::Sent,
                'sequence' => $sequence,
                'number' => sprintf('INV-%s-%04d', $invoice->issue_date->format('Y'), $sequence),
                'sent_at' => now(),
                'billed_to' => [
                    'name' => $customer->name,
                    'email' => $customer->email,
                    'trn' => $customer->trn,
                    'emirate' => $customer->emirate?->label(),
                    'address' => $customer->address,
                ],
            ])->save();

            return $invoice->load(Invoice::DETAIL_RELATIONS);
        });
    }
}
