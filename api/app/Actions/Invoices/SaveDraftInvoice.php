<?php

namespace App\Actions\Invoices;

use App\Enums\VatRate;
use App\Models\Invoice;
use App\Models\User;
use App\Support\InvoiceCalculator;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;

/**
 * Creates a draft, or replaces an existing draft's header and line items.
 *
 * Totals are always recalculated here from quantity × unit price. Anything the
 * client sends as a total is ignored: the browser only *previews* the maths.
 */
final class SaveDraftInvoice
{
    /**
     * @param  array{customer_id: int, issue_date: string, due_date: string, notes?: string|null, items: list<array{description: string, quantity: string|int|float, unit_price: int, vat_rate: string}>}  $data
     */
    public function handle(User $user, array $data, ?Invoice $invoice = null): Invoice
    {
        $invoice ??= new Invoice;

        if ($invoice->exists) {
            $invoice->ensureIsDraft('edited');
        }

        return DB::transaction(function () use ($user, $data, $invoice) {
            $lines = collect($data['items'])->values()->map(fn (array $item, int $index) => [
                'position' => $index + 1,
                'description' => trim($item['description']),
                'quantity' => $item['quantity'],
                'unit_price' => (int) $item['unit_price'],
                'vat_rate' => VatRate::from($item['vat_rate']),
                'line_total' => InvoiceCalculator::lineTotal($item['quantity'], (int) $item['unit_price']),
            ]);

            $totals = InvoiceCalculator::totals($lines);

            $invoice->fill(Arr::only($data, ['customer_id', 'issue_date', 'due_date', 'notes']));
            $invoice->user()->associate($user);
            $invoice->forceFill([
                'subtotal' => $totals['subtotal'],
                'vat_total' => $totals['vat_total'],
                'total' => $totals['total'],
            ])->save();

            // Replacing all lines is simpler and safer than diffing them, and fine for drafts.
            $invoice->items()->delete();
            $invoice->items()->createMany($lines->all());

            return $invoice->load(['customer', 'items']);
        });
    }
}
