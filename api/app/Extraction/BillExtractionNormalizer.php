<?php

namespace App\Extraction;

use App\Enums\VatRate;
use App\Http\Requests\Bills\BillRequest;
use App\Support\InvoiceCalculator;
use DateTimeImmutable;

/**
 * Turns the model's raw JSON into a pre-filled bill, and checks it.
 *
 * The model's output is treated like any other untrusted input: every field is
 * type-checked and converted (AED → integer fils, TRN → digits), and the numbers
 * are cross-checked against each other with the same InvoiceCalculator that saves
 * real bills. Anything doubtful becomes a warning on that field, so the review
 * screen can point the user at exactly what to check. Nothing is saved here; the
 * user reviews the form and saves it through the normal bill validation.
 *
 * Pure (no database, no clock): today's date is passed in, which keeps it unit-testable.
 */
final class BillExtractionNormalizer
{
    public const MAX_LINES = 100;

    /** @var list<array{field: string, message: string}> */
    private array $warnings = [];

    /**
     * @param  array<string, mixed>  $raw
     * @return array{result: array<string, mixed>, warnings: list<array{field: string, message: string}>}
     */
    public function normalize(array $raw, string $today): array
    {
        $this->warnings = [];

        $supplierName = $this->text($raw['supplier_name'] ?? null, 255);
        if ($supplierName === null) {
            $this->warn('supplier_name', 'The supplier’s name wasn’t found. Enter it as printed on the invoice.');
        }

        $invoiceNumber = $this->text($raw['invoice_number'] ?? $raw['supplier_invoice_number'] ?? null, 64);
        if ($invoiceNumber === null) {
            $this->warn('supplier_invoice_number', 'The invoice number wasn’t found.');
        }

        [$issueDate, $dueDate] = $this->dates($raw['issue_date'] ?? null, $raw['due_date'] ?? null, $today);

        $currency = strtoupper((string) $this->text($raw['currency'] ?? null, 3)) ?: 'AED';
        if (! preg_match('/^[A-Z]{3}$/', $currency)) {
            $currency = 'AED';
        }
        if ($currency !== 'AED') {
            $this->warn('currency', "This invoice is in {$currency}. InvoiceFlow records bills in AED, so convert the amounts before saving.");
        }

        $documentTotals = [
            'subtotal' => $this->fils($raw['subtotal'] ?? null),
            'vat_total' => $this->fils($raw['vat_total'] ?? null),
            'total' => $this->fils($raw['total'] ?? null),
        ];

        $trn = $this->trn($raw['supplier_trn'] ?? null);
        $items = $this->items($raw['lines'] ?? $raw['items'] ?? null, $documentTotals, $trn !== null);

        if ($trn === null && $this->chargesVat($items, $documentTotals)) {
            $this->warn('supplier_trn', 'VAT is charged but no supplier TRN was found. You can only reclaim VAT on a tax invoice that shows the supplier’s TRN.');
        }

        $totals = $this->crossCheck($items, $documentTotals);

        return [
            'result' => [
                'supplier_name' => $supplierName,
                'supplier_trn' => $trn,
                'supplier_invoice_number' => $invoiceNumber,
                'issue_date' => $issueDate,
                'due_date' => $dueDate,
                'currency' => $currency,
                'items' => $items,
                'document_totals' => $documentTotals, // as printed
                'totals' => $totals,                  // as InvoiceCalculator works them out (null if a price is missing)
            ],
            'warnings' => $this->warnings,
        ];
    }

    // --- Fields --------------------------------------------------------------

    private function text(mixed $value, int $max): ?string
    {
        if (! is_scalar($value)) {
            return null;
        }
        $text = trim(preg_replace('/\s+/u', ' ', (string) $value) ?? '');

        return $text === '' || strtolower($text) === 'null' ? null : mb_substr($text, 0, $max);
    }

    private function trn(mixed $value): ?string
    {
        $digits = preg_replace('/\D/', '', is_scalar($value) ? (string) $value : '');
        if ($digits === '' || $digits === null) {
            return null;
        }

        if (strlen($digits) !== 15 || ! str_starts_with($digits, '100')) {
            $this->warn('supplier_trn', 'This doesn’t look like a UAE TRN (15 digits starting with 100). Check it against the invoice.');
        }

        return substr($digits, 0, 20);
    }

    /** @return array{?string, ?string} */
    private function dates(mixed $issue, mixed $due, string $today): array
    {
        $issueDate = $this->date($issue);
        $dueDate = $this->date($due);

        if ($issueDate === null) {
            $this->warn('issue_date', $issue === null ? 'The invoice date wasn’t found.' : 'The invoice date couldn’t be read.');
        } elseif ($issueDate > $today) {
            $this->warn('issue_date', 'This date is in the future. Check it: dates on UAE invoices are written day first.');
        }

        if ($dueDate === null && $due !== null && $due !== '') {
            $this->warn('due_date', 'The due date couldn’t be read.');
        }

        if ($issueDate !== null && $dueDate !== null && $dueDate < $issueDate) {
            $this->warn('due_date', 'The due date read was before the invoice date, so it was left empty.');
            $dueDate = null;
        }

        return [$issueDate, $dueDate];
    }

    /** Y-m-d as asked; day-first d/m/Y as a fallback, since that's how UAE invoices print dates. */
    private function date(mixed $value): ?string
    {
        if (! is_string($value) || trim($value) === '') {
            return null;
        }
        $value = trim($value);

        foreach (['!Y-m-d', '!d/m/Y', '!d-m-Y', '!d.m.Y'] as $format) {
            $date = DateTimeImmutable::createFromFormat($format, $value);
            $errors = DateTimeImmutable::getLastErrors();
            if ($date !== false && ($errors === false || ($errors['warning_count'] === 0 && $errors['error_count'] === 0))) {
                $year = (int) $date->format('Y');

                return $year >= 2000 && $year <= 2100 ? $date->format('Y-m-d') : null;
            }
        }

        return null;
    }

    /** 1250.5, "1,250.50" or "AED 1250.50" → 125050 fils. */
    private function fils(mixed $value): ?int
    {
        if (is_string($value)) {
            $value = preg_replace('/[^\d.\-]/', '', $value);
        }
        if (! is_numeric($value)) {
            return null;
        }

        return (int) round(((float) $value) * 100);
    }

    // --- Lines ---------------------------------------------------------------

    /**
     * @param  array{subtotal: ?int, vat_total: ?int, total: ?int}  $documentTotals
     * @return list<array{description: string, quantity: string, unit_price: ?int, vat_rate: string}>
     */
    private function items(mixed $lines, array $documentTotals, bool $hasTrn): array
    {
        $lines = is_array($lines) ? array_values(array_filter($lines, 'is_array')) : [];

        if ($lines === []) {
            if ($documentTotals['subtotal'] === null) {
                $this->warn('items', 'No line items were found. Add them from the invoice.');

                return [];
            }

            // Only the totals are legible (a till receipt, say): one line that reproduces them.
            $this->warn('items', 'Only the totals could be read, so one line was created from them. Split it up if you need to.');
            $lines = [[
                'description' => 'As per supplier invoice',
                'quantity' => 1,
                'unit_price' => $documentTotals['subtotal'] / 100,
                'vat_percent' => ($documentTotals['vat_total'] ?? 0) > 0 ? 5 : 0,
            ]];
        }

        if (count($lines) > self::MAX_LINES) {
            $this->warn('items', 'Only the first '.self::MAX_LINES.' lines were kept.');
            $lines = array_slice($lines, 0, self::MAX_LINES);
        }

        $items = [];
        foreach ($lines as $index => $line) {
            $description = $this->text($line['description'] ?? null, 500);
            if ($description === null) {
                $this->warn("items.{$index}.description", 'This line’s description wasn’t found.');
            }

            $items[] = [
                'description' => $description ?? '',
                'quantity' => $this->quantity($line['quantity'] ?? null, $index),
                'unit_price' => $this->unitPrice($line['unit_price'] ?? null, $index),
                'vat_rate' => $this->vatRate($line['vat_percent'] ?? $line['vat_rate'] ?? null, $index, $hasTrn)->value,
            ];
        }

        return $items;
    }

    private function quantity(mixed $value, int $index): string
    {
        if (is_string($value)) {
            $value = str_replace(',', '', $value);
        }
        if ($value === null || $value === '') {
            return '1.000';
        }

        $quantity = is_numeric($value) ? round((float) $value, 3) : 0.0;
        if ($quantity <= 0 || $quantity > BillRequest::MAX_QUANTITY) {
            $this->warn("items.{$index}.quantity", 'The quantity couldn’t be read, so it was set to 1.');

            return '1.000';
        }

        return number_format($quantity, 3, '.', '');
    }

    private function unitPrice(mixed $value, int $index): ?int
    {
        $fils = $this->fils($value);

        if ($fils === null) {
            $this->warn("items.{$index}.unit_price", 'The price couldn’t be read.');

            return null;
        }
        if ($fils < 0) {
            $this->warn("items.{$index}.unit_price", 'Discount lines can’t be negative here. Take the discount off another line’s price.');

            return null;
        }
        if ($fils > BillRequest::MAX_UNIT_PRICE) {
            $this->warn("items.{$index}.unit_price", 'This price is above the AED 999,999.99 limit per line.');
        }

        return $fils;
    }

    private function vatRate(mixed $percent, int $index, bool $hasTrn): VatRate
    {
        if (is_string($percent)) {
            $percent = match (strtolower(trim($percent))) {
                'standard' => 5,
                'zero', 'exempt' => 0,
                default => str_replace('%', '', $percent),
            };
        }

        if (! is_numeric($percent)) {
            $assumed = $hasTrn ? VatRate::Standard : VatRate::Zero;
            $this->warn("items.{$index}.vat_rate", "The VAT rate isn’t shown, so {$assumed->label()} was assumed.");

            return $assumed;
        }

        $percent = (float) $percent;
        if (abs($percent - 5) < 0.01) {
            return VatRate::Standard;
        }
        if (abs($percent) < 0.01) {
            return VatRate::Zero;
        }

        $this->warn("items.{$index}.vat_rate", 'VAT of '.rtrim(rtrim(number_format($percent, 2), '0'), '.').'% isn’t a UAE rate. Check this line.');

        return VatRate::Standard;
    }

    // --- Cross-checks ----------------------------------------------------------

    /**
     * @param  list<array{description: string, quantity: string, unit_price: ?int, vat_rate: string}>  $items
     * @param  array{subtotal: ?int, vat_total: ?int, total: ?int}  $documentTotals
     */
    private function chargesVat(array $items, array $documentTotals): bool
    {
        if (($documentTotals['vat_total'] ?? 0) > 0) {
            return true;
        }

        return in_array(VatRate::Standard->value, array_column($items, 'vat_rate'), true);
    }

    /**
     * Recalculates the bill exactly as it will be saved, and compares it with the
     * totals printed on the document. A mismatch usually means a misread digit,
     * a missed line, or VAT-inclusive prices.
     *
     * @param  list<array{description: string, quantity: string, unit_price: ?int, vat_rate: string}>  $items
     * @param  array{subtotal: ?int, vat_total: ?int, total: ?int}  $documentTotals
     * @return array{subtotal: int, vat_total: int, total: int}|null
     */
    private function crossCheck(array $items, array $documentTotals): ?array
    {
        if ($items === [] || in_array(null, array_column($items, 'unit_price'), true)) {
            return null;
        }

        $calculated = InvoiceCalculator::totals(array_map(fn (array $item) => [
            'quantity' => $item['quantity'],
            'unit_price' => (int) $item['unit_price'],
            'vat_rate' => VatRate::from($item['vat_rate']),
        ], $items));

        $totals = [
            'subtotal' => $calculated['subtotal'],
            'vat_total' => $calculated['vat_total'],
            'total' => $calculated['total'],
        ];

        // Suppliers may round VAT per line; allow a fil per line before calling it a mismatch.
        $tolerance = max(1, count($items));
        $differs = fn (?int $printed, int $ours) => $printed !== null && abs($printed - $ours) > $tolerance;

        if ($differs($documentTotals['subtotal'], $totals['subtotal'])) {
            $looksVatInclusive = $documentTotals['total'] !== null && ! $differs($documentTotals['total'], $totals['subtotal']);
            $this->warn('totals', $looksVatInclusive
                ? 'The line prices seem to include VAT. Enter them excluding VAT.'
                : 'The lines add up to '.$this->aed($totals['subtotal']).' before VAT, but the invoice says '
                    .$this->aed((int) $documentTotals['subtotal']).'. Check the quantities and prices.');
        } elseif ($differs($documentTotals['vat_total'], $totals['vat_total'])) {
            $this->warn('totals', 'VAT works out to '.$this->aed($totals['vat_total']).', but the invoice shows '
                .$this->aed((int) $documentTotals['vat_total']).'. Check each line’s VAT rate.');
        } elseif ($differs($documentTotals['total'], $totals['total'])) {
            $this->warn('totals', 'The total works out to '.$this->aed($totals['total']).', but the invoice says '
                .$this->aed((int) $documentTotals['total']).'.');
        }

        return $totals;
    }

    private function aed(int $fils): string
    {
        return 'AED '.number_format($fils / 100, 2);
    }

    private function warn(string $field, string $message): void
    {
        $this->warnings[] = ['field' => $field, 'message' => $message];
    }
}
