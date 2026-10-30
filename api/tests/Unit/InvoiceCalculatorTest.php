<?php

namespace Tests\Unit;

use App\Enums\VatRate;
use App\Support\InvoiceCalculator;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

/**
 * The same cases are asserted in web/src/features/invoices/money.test.ts (milestone 6)
 * so PHP and TypeScript can never disagree on a total.
 */
class InvoiceCalculatorTest extends TestCase
{
    /** @return array<string, array{string, int, int}> */
    public static function lineTotals(): array
    {
        return [
            'whole quantity' => ['2', 15000, 30000],
            'fractional quantity' => ['1.5', 10000, 15000],
            'three decimals' => ['0.333', 100, 33],          // 33.3 → 33
            'rounds half up' => ['0.005', 100, 1],           // 0.5 fils → 1
            'just under half' => ['0.004', 100, 0],          // 0.4 fils → 0
            'free item' => ['3', 0, 0],
            // Largest allowed line: still far below JavaScript's 2^53 integer limit.
            'largest allowed line' => ['9999.999', 99999999, 999999890000],
        ];
    }

    #[DataProvider('lineTotals')]
    public function test_line_total(string $quantity, int $unitPrice, int $expected): void
    {
        $this->assertSame($expected, InvoiceCalculator::lineTotal($quantity, $unitPrice));
    }

    public function test_vat_is_5_percent_on_standard_lines_only(): void
    {
        $totals = InvoiceCalculator::totals([
            ['quantity' => '1', 'unit_price' => 100000, 'vat_rate' => VatRate::Standard], // AED 1,000.00
            ['quantity' => '2', 'unit_price' => 25000, 'vat_rate' => VatRate::Zero],     // AED 500.00
            ['quantity' => '1', 'unit_price' => 30000, 'vat_rate' => VatRate::Exempt],   // AED 300.00
        ]);

        $this->assertSame(180000, $totals['subtotal']);
        $this->assertSame(5000, $totals['vat_total']);
        $this->assertSame(185000, $totals['total']);
        $this->assertSame(['standard', 'zero', 'exempt'], array_keys($totals['vat_breakdown']));
        $this->assertSame(100000, $totals['vat_breakdown']['standard']['taxable']);
        $this->assertSame(0, $totals['vat_breakdown']['zero']['vat']);
    }

    public function test_vat_is_rounded_once_on_the_sum_not_per_line(): void
    {
        // Three lines of AED 0.10: per-line VAT would be 3 × round(0.5 fils) = 3 fils;
        // invoice-level is round(30 × 5%) = round(1.5) = 2 fils.
        $line = ['quantity' => '1', 'unit_price' => 10, 'vat_rate' => VatRate::Standard];

        $totals = InvoiceCalculator::totals([$line, $line, $line]);

        $this->assertSame(30, $totals['subtotal']);
        $this->assertSame(2, $totals['vat_total']);
    }

    public function test_empty_invoice_totals_are_zero(): void
    {
        $totals = InvoiceCalculator::totals([]);

        $this->assertSame(['subtotal' => 0, 'vat_total' => 0, 'total' => 0, 'vat_breakdown' => []], $totals);
    }
}
