<?php

namespace App\Support;

use App\Enums\VatRate;

/**
 * All invoice arithmetic, in integer fils. Pure functions, no database:
 * easy to unit test, and mirrored line for line in web/src/features/invoices/money.ts
 * so the live totals in the browser always match what the server saves.
 *
 * Rounding: half-up, done with integer maths (intdiv) rather than float round().
 * VAT is calculated per rate on the summed line totals (invoice-level rounding),
 * which keeps the VAT figure within one fil of "subtotal × 5%".
 */
final class InvoiceCalculator
{
    /** "1.5" → 1500. Quantities have at most 3 decimals (validated). */
    public static function quantityToMilli(string|int|float $quantity): int
    {
        return (int) round(((float) $quantity) * 1000);
    }

    public static function lineTotal(string|int|float $quantity, int $unitPrice): int
    {
        $raw = self::quantityToMilli($quantity) * $unitPrice; // fils × 1000

        return intdiv($raw + 500, 1000);
    }

    public static function vat(int $taxable, VatRate $rate): int
    {
        return intdiv($taxable * $rate->percent() + 50, 100);
    }

    /**
     * @param  iterable<array{quantity: string|int|float, unit_price: int, vat_rate: VatRate}>  $lines
     * @return array{
     *     subtotal: int,
     *     vat_total: int,
     *     total: int,
     *     vat_breakdown: array<string, array{rate: string, label: string, percent: int, taxable: int, vat: int}>
     * }
     */
    public static function totals(iterable $lines): array
    {
        $taxableByRate = [];

        foreach ($lines as $line) {
            $rate = $line['vat_rate'];
            $taxableByRate[$rate->value] = ($taxableByRate[$rate->value] ?? 0)
                + self::lineTotal($line['quantity'], (int) $line['unit_price']);
        }

        $breakdown = [];
        $vatTotal = 0;

        foreach (VatRate::cases() as $rate) {
            if (! array_key_exists($rate->value, $taxableByRate)) {
                continue;
            }
            $taxable = $taxableByRate[$rate->value];
            $vat = self::vat($taxable, $rate);
            $vatTotal += $vat;
            $breakdown[$rate->value] = [
                'rate' => $rate->value,
                'label' => $rate->label(),
                'percent' => $rate->percent(),
                'taxable' => $taxable,
                'vat' => $vat,
            ];
        }

        $subtotal = array_sum($taxableByRate);

        return [
            'subtotal' => $subtotal,
            'vat_total' => $vatTotal,
            'total' => $subtotal + $vatTotal,
            'vat_breakdown' => $breakdown,
        ];
    }
}
