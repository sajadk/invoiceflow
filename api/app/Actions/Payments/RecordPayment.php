<?php

namespace App\Actions\Payments;

use App\Enums\InvoiceStatus;
use App\Models\Invoice;
use App\Models\Payment;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Records a full or partial payment and keeps invoice.amount_paid in step.
 * When the balance reaches zero the invoice becomes "paid".
 */
final class RecordPayment
{
    /**
     * @param  array{amount: int, paid_on: string, method: string, reference?: string|null, notes?: string|null}  $data
     */
    public function handle(Invoice $invoice, array $data): Payment
    {
        return DB::transaction(function () use ($invoice, $data) {
            // Lock the invoice row: two people recording the last payment at the same
            // moment must not both pass the balance check and overpay it.
            $invoice = Invoice::query()->lockForUpdate()->findOrFail($invoice->id);
            $invoice->ensureCanReceivePayment();

            $amount = (int) $data['amount'];
            $balance = $invoice->balanceDue();

            if ($amount > $balance) {
                throw ValidationException::withMessages([
                    'amount' => sprintf('That’s more than the balance due (AED %s).', number_format($balance / 100, 2)),
                ]);
            }

            $payment = new Payment($data);
            $payment->user()->associate($invoice->user_id);
            $payment->invoice()->associate($invoice);
            $payment->save();

            $invoice->amount_paid += $amount;
            if ($invoice->amount_paid === $invoice->total) {
                $invoice->status = InvoiceStatus::Paid;
                $invoice->paid_at = now();
            }
            $invoice->save();

            return $payment;
        });
    }
}
