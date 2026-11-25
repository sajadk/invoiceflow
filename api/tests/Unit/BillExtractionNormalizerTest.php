<?php

namespace Tests\Unit;

use App\Extraction\BillExtractionNormalizer;
use App\Extraction\OpenAiCompatibleExtractor;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

/**
 * The model's answer is untrusted input. These cases pin down how it's
 * converted and which doubts are flagged for the user to check.
 */
class BillExtractionNormalizerTest extends TestCase
{
    private const TODAY = '2026-03-15';

    /** @return array{result: array<string, mixed>, warnings: list<array{field: string, message: string}>} */
    private function normalize(array $raw): array
    {
        return (new BillExtractionNormalizer)->normalize([
            'supplier_name' => 'Example Office Supplies LLC',
            'supplier_trn' => '100000000012345',
            'invoice_number' => 'EOS-1',
            'issue_date' => '2026-03-12',
            'due_date' => null,
            'currency' => 'AED',
            'lines' => [['description' => 'Paper', 'quantity' => 2, 'unit_price' => 100, 'vat_percent' => 5]],
            'subtotal' => 200,
            'vat_total' => 10,
            'total' => 210,
            ...$raw,
        ], self::TODAY);
    }

    /** @return list<string> */
    private function fields(array $normalized): array
    {
        return array_column($normalized['warnings'], 'field');
    }

    public function test_a_clean_answer_converts_to_fils_and_form_values_without_warnings(): void
    {
        $normalized = $this->normalize([
            'supplier_trn' => '100-0000-0001-2345',
            'lines' => [
                ['description' => "Paper\n A4", 'quantity' => '2', 'unit_price' => 'AED 1,050.50', 'vat_percent' => '5%'],
                ['description' => 'Freight', 'quantity' => 1, 'unit_price' => 50, 'vat_percent' => 0],
            ],
            'subtotal' => '2,151.00',
            'vat_total' => 105.05,
            'total' => 2256.05,
        ]);

        $this->assertSame([], $normalized['warnings']);
        $this->assertSame('100000000012345', $normalized['result']['supplier_trn']);
        $this->assertSame([
            ['description' => 'Paper A4', 'quantity' => '2.000', 'unit_price' => 105050, 'vat_rate' => 'standard'],
            ['description' => 'Freight', 'quantity' => '1.000', 'unit_price' => 5000, 'vat_rate' => 'zero'],
        ], $normalized['result']['items']);
        $this->assertSame(['subtotal' => 215100, 'vat_total' => 10505, 'total' => 225605], $normalized['result']['totals']);
    }

    /** @return array<string, array{array<string, mixed>, string}> */
    public static function doubts(): array
    {
        return [
            'TRN of the wrong length' => [['supplier_trn' => '10012345'], 'supplier_trn'],
            'VAT charged without a TRN' => [['supplier_trn' => null], 'supplier_trn'],
            'missing supplier' => [['supplier_name' => ''], 'supplier_name'],
            'missing invoice number' => [['invoice_number' => null], 'supplier_invoice_number'],
            'missing date' => [['issue_date' => null], 'issue_date'],
            'unreadable date' => [['issue_date' => 'sometime in March'], 'issue_date'],
            'future date' => [['issue_date' => '2026-12-03'], 'issue_date'],
            'foreign currency' => [['currency' => 'USD'], 'currency'],
            'lines don’t match the subtotal' => [['subtotal' => 250, 'total' => 260], 'totals'],
            'VAT doesn’t match' => [['vat_total' => 12, 'total' => 212], 'totals'],
            'total doesn’t match' => [['total' => 999], 'totals'],
            'unknown VAT rate' => [['lines' => [['description' => 'X', 'quantity' => 1, 'unit_price' => 200, 'vat_percent' => 15]]], 'items.0.vat_rate'],
            'missing price' => [['lines' => [['description' => 'X', 'quantity' => 1, 'unit_price' => null, 'vat_percent' => 5]]], 'items.0.unit_price'],
            'negative price' => [['lines' => [['description' => 'Discount', 'quantity' => 1, 'unit_price' => -20, 'vat_percent' => 5]]], 'items.0.unit_price'],
            'bad quantity' => [['lines' => [['description' => 'X', 'quantity' => 0, 'unit_price' => 200, 'vat_percent' => 5]]], 'items.0.quantity'],
            'no lines and no totals' => [['lines' => [], 'subtotal' => null], 'items'],
        ];
    }

    #[DataProvider('doubts')]
    public function test_doubtful_values_are_flagged_on_their_field(array $raw, string $field): void
    {
        $this->assertContains($field, $this->fields($this->normalize($raw)));
    }

    public function test_dates_written_day_first_are_understood(): void
    {
        $normalized = $this->normalize(['issue_date' => '05/02/2026', 'due_date' => '07.03.2026']);

        $this->assertSame('2026-02-05', $normalized['result']['issue_date']);
        $this->assertSame('2026-03-07', $normalized['result']['due_date']);
        $this->assertSame([], $normalized['warnings']);
    }

    public function test_a_due_date_before_the_invoice_date_is_dropped(): void
    {
        $normalized = $this->normalize(['due_date' => '2026-03-01']);

        $this->assertNull($normalized['result']['due_date']);
        $this->assertSame(['due_date'], $this->fields($normalized));
    }

    public function test_vat_inclusive_prices_are_recognised(): void
    {
        $normalized = $this->normalize(['lines' => [['description' => 'Paper', 'quantity' => 2, 'unit_price' => 105, 'vat_percent' => 5]]]);

        $this->assertSame('The line prices seem to include VAT. Enter them excluding VAT.', $normalized['warnings'][0]['message']);
    }

    public function test_one_line_is_made_from_the_totals_when_no_lines_are_legible(): void
    {
        $normalized = $this->normalize(['lines' => []]);

        $this->assertSame([['description' => 'As per supplier invoice', 'quantity' => '1.000', 'unit_price' => 20000, 'vat_rate' => 'standard']], $normalized['result']['items']);
        $this->assertSame(['items'], $this->fields($normalized));
    }

    public function test_a_small_rounding_difference_is_not_a_mismatch(): void
    {
        // Three lines with VAT rounded per line by the supplier: off by a fil from rounding once per rate.
        $normalized = $this->normalize([
            'lines' => array_fill(0, 3, ['description' => 'X', 'quantity' => 1, 'unit_price' => 0.1, 'vat_percent' => 5]),
            'subtotal' => 0.3,
            'vat_total' => 0.03, // 3 × 0.01 per line; once per rate it's 0.02
            'total' => 0.33,
        ]);

        $this->assertNotContains('totals', $this->fields($normalized));
    }

    public function test_a_missing_vat_rate_is_assumed_from_whether_the_supplier_has_a_trn(): void
    {
        $line = ['description' => 'X', 'quantity' => 1, 'unit_price' => 200];

        $this->assertSame('standard', $this->normalize(['lines' => [$line]])['result']['items'][0]['vat_rate']);
        $this->assertSame('zero', $this->normalize(['lines' => [$line], 'supplier_trn' => null, 'vat_total' => 0, 'total' => 200])['result']['items'][0]['vat_rate']);
    }

    public function test_json_is_found_inside_fences_and_chatter(): void
    {
        $this->assertSame(['a' => 1], OpenAiCompatibleExtractor::parseJson("Sure! ```json\n{\"a\": 1}\n```"));
        $this->assertNull(OpenAiCompatibleExtractor::parseJson('no json here'));
        $this->assertNull(OpenAiCompatibleExtractor::parseJson('[1, 2]'));
    }
}
