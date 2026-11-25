<?php

namespace App\Console\Commands;

use App\Extraction\BillExtractionNormalizer;
use App\Extraction\DocumentPages;
use App\Extraction\ExtractionException;
use App\Extraction\InvoiceExtractor;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Sleep;

/**
 * Scores the configured AI model on the evaluation set in tests/Fixtures/extraction:
 * fictional invoices with known answers (generate.py). Runs the real pipeline
 * (render → AI → normalise), so prompt or model changes can be compared with numbers
 * instead of impressions.
 *
 *   php artisan invoiceflow:eval-extraction
 *   php artisan invoiceflow:eval-extraction --only=freight --details
 *   AI_MODEL=gemini-2.5-flash-lite php artisan invoiceflow:eval-extraction
 */
class EvalExtraction extends Command
{
    protected $signature = 'invoiceflow:eval-extraction
        {--only= : Only fixtures whose name contains this}
        {--delay=6 : Seconds between documents (free tiers allow ~10 requests a minute)}
        {--details : Show every mismatch}';

    protected $description = 'Measure AI invoice capture accuracy on the evaluation set';

    /** Header fields compared one to one. */
    private const FIELDS = ['supplier_name', 'supplier_trn', 'supplier_invoice_number', 'issue_date', 'due_date'];

    /** @var array<string, array{0: int, 1: int}> field => [correct, total] */
    private array $score = [];

    public function handle(InvoiceExtractor $extractor, DocumentPages $documentPages, BillExtractionNormalizer $normalizer): int
    {
        $fixtures = $this->fixtures();
        if ($fixtures === []) {
            $this->error('No fixtures found in tests/Fixtures/extraction. Run generate.py there first (not included in the production image).');

            return self::FAILURE;
        }
        if (blank(config('invoiceflow.extraction.api_key'))) {
            $this->error('AI_API_KEY isn’t set.');

            return self::FAILURE;
        }

        $this->info('Model: '.config('invoiceflow.extraction.model').' · '.count($fixtures).' documents');
        $rows = [];
        $durations = [];

        foreach (array_values($fixtures) as $i => [$name, $document, $expected]) {
            if ($i > 0) {
                Sleep::for((int) $this->option('delay'))->seconds();
            }

            $started = microtime(true);
            try {
                $pages = $documentPages->fromUpload(File::get($document), (string) File::mimeType($document), (int) config('invoiceflow.extraction.max_pages'));
                $answer = $extractor->extract($pages['pages']);
                ['result' => $actual, 'warnings' => $warnings] = $normalizer->normalize($answer['data'], today()->toDateString());
            } catch (ExtractionException $exception) {
                $rows[] = [$name, '<fg=red>failed</>', $exception->getMessage(), '', ''];

                continue;
            }
            $durations[] = microtime(true) - $started;

            [$correct, $total, $mismatches] = $this->compare($expected, $actual);
            $rows[] = [
                $name,
                $correct === $total ? '<fg=green>✓ all</>' : "<fg=yellow>{$correct}/{$total}</>",
                implode(', ', array_keys($mismatches)) ?: '–',
                count($warnings),
                number_format(end($durations), 1).'s',
            ];

            if ($this->option('details')) {
                foreach ($mismatches as $field => [$want, $got]) {
                    $this->line("  {$name} · {$field}: expected <fg=green>".json_encode($want).'</> got <fg=red>'.json_encode($got).'</>');
                }
                foreach ($warnings as $warning) {
                    $this->line("  {$name} · warning [{$warning['field']}] {$warning['message']}");
                }
            }
        }

        $this->table(['Document', 'Fields', 'Wrong', 'Warnings', 'Time'], $rows);

        $this->table(['Field', 'Accuracy'], array_map(
            fn (string $field, array $s) => [$field, $s[1] ? sprintf('%d/%d (%.0f%%)', $s[0], $s[1], 100 * $s[0] / $s[1]) : '–'],
            array_keys($this->score),
            $this->score,
        ));

        $correct = array_sum(array_column($this->score, 0));
        $total = array_sum(array_column($this->score, 1));
        $this->info(sprintf(
            'Overall: %d/%d fields (%.1f%%) · average %.1fs per document',
            $correct, $total, $total ? 100 * $correct / $total : 0, $durations ? array_sum($durations) / count($durations) : 0,
        ));

        return self::SUCCESS;
    }

    /** @return list<array{0: string, 1: string, 2: array<string, mixed>}> */
    private function fixtures(): array
    {
        $directory = base_path('tests/Fixtures/extraction');
        $fixtures = [];

        foreach (File::glob("{$directory}/*.expected.json") as $expectedFile) {
            $name = basename($expectedFile, '.expected.json');
            if ($this->option('only') && ! str_contains($name, (string) $this->option('only'))) {
                continue;
            }
            $document = collect(['pdf', 'jpg', 'png', 'webp'])
                ->map(fn ($extension) => "{$directory}/{$name}.{$extension}")
                ->first(fn ($path) => File::exists($path));

            if ($document !== null) {
                $fixtures[] = [$name, $document, json_decode(File::get($expectedFile), true)];
            }
        }

        return $fixtures;
    }

    /**
     * @param  array<string, mixed>  $expected
     * @param  array<string, mixed>  $actual
     * @return array{0: int, 1: int, 2: array<string, array{0: mixed, 1: mixed}>}
     */
    private function compare(array $expected, array $actual): array
    {
        $checks = [];
        foreach (self::FIELDS as $field) {
            $checks[$field] = [$expected[$field], $actual[$field] ?? null];
        }

        // Lines: count, then quantity + price + VAT rate of each line in order (descriptions vary in wording).
        $checks['line_count'] = [count($expected['items']), count($actual['items'] ?? [])];
        foreach ($expected['items'] as $index => $line) {
            $got = $actual['items'][$index] ?? [];
            $checks['lines'][] = [
                [$line['quantity'], $line['unit_price'], $line['vat_rate']],
                [$got['quantity'] ?? null, $got['unit_price'] ?? null, $got['vat_rate'] ?? null],
            ];
        }

        foreach (['subtotal', 'vat_total', 'total'] as $field) {
            $checks[$field] = [$expected['totals'][$field], $actual['totals'][$field] ?? null];
        }

        $correct = 0;
        $total = 0;
        $mismatches = [];
        foreach ($checks as $field => $check) {
            foreach ($field === 'lines' ? $check : [$check] as $index => [$want, $got]) {
                $ok = $field === 'supplier_name'
                    ? $this->sameName((string) $want, (string) $got)
                    : $want === $got;
                $this->score[$field] ??= [0, 0];
                $this->score[$field][0] += (int) $ok;
                $this->score[$field][1]++;
                $correct += (int) $ok;
                $total++;
                if (! $ok) {
                    $mismatches[$field === 'lines' ? "line ".($index + 1) : $field] = [$want, $got];
                }
            }
        }

        return [$correct, $total, $mismatches];
    }

    /** "EXAMPLE OFFICE SUPPLIES L.L.C." counts as "Example Office Supplies LLC". */
    private function sameName(string $a, string $b): bool
    {
        $normalise = fn (string $name) => preg_replace('/[^a-z0-9]/', '', strtolower($name));

        return $normalise($a) === $normalise($b);
    }
}
