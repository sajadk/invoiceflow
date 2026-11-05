<?php

namespace App\Actions\Payments;

use App\Enums\InvoiceStatus;
use App\Models\Invoice;
use App\Models\Payment;
use Illuminate\Support\Facades\DB;

/**
 * Removes a payment recorded by mistake. A paid invoice goes back to "sent".
 */
final class DeletePayment
{
    public function handle(Payment $payment): Invoice
    {
        return DB::transaction(function () use ($payment) {
            $invoice = Invoice::query()->lockForUpdate()->findOrFail($payment->invoice_id);

            $payment->delete();

            $invoice->amount_paid = max(0, $invoice->amount_paid - $payment->amount);
            if ($invoice->status === InvoiceStatus::Paid) {
                $invoice->status = InvoiceStatus::Sent;
                $invoice->paid_at = null;
            }
            $invoice->save();

            return $invoice;
        });
    }
}
