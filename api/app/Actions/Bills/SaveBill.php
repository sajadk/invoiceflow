<?php

namespace App\Actions\Bills;

use App\Enums\VatRate;
use App\Models\Bill;
use App\Models\User;
use App\Support\InvoiceCalculator;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;

/**
 * Creates a bill, or replaces an unpaid bill's details and lines.
 * Totals are recalculated with the same calculator as sales invoices: client totals are ignored.
 */
final class SaveBill
{
    /**
     * @param  array{supplier_name: string, supplier_trn?: string|null, supplier_invoice_number: string, issue_date: string, due_date?: string|null, notes?: string|null, items: list<array{description: string, quantity: string|int|float, unit_price: int, vat_rate: string}>}  $data
     */
    public function handle(User $user, array $data, ?Bill $bill = null): Bill
    {
        $bill ??= new Bill;

        if ($bill->exists) {
            $bill->ensureIsUnpaid('edited');
        }

        return DB::transaction(function () use ($user, $data, $bill) {
            $lines = collect($data['items'])->values()->map(fn (array $item, int $index) => [
                'position' => $index + 1,
                'description' => trim($item['description']),
                'quantity' => $item['quantity'],
                'unit_price' => (int) $item['unit_price'],
                'vat_rate' => VatRate::from($item['vat_rate']),
                'line_total' => InvoiceCalculator::lineTotal($item['quantity'], (int) $item['unit_price']),
            ]);

            $totals = InvoiceCalculator::totals($lines);

            $bill->fill(Arr::only($data, ['supplier_name', 'supplier_trn', 'supplier_invoice_number', 'issue_date', 'due_date', 'notes']));
            $bill->user()->associate($user);
            $bill->forceFill([
                'subtotal' => $totals['subtotal'],
                'vat_total' => $totals['vat_total'],
                'total' => $totals['total'],
            ])->save();

            $bill->items()->delete();
            $bill->items()->createMany($lines->all());

            return $bill->load('items');
        });
    }
}
