<?php

namespace App\Jobs;

use App\Enums\ExtractionStatus;
use App\Extraction\BillExtractionNormalizer;
use App\Extraction\DocumentPages;
use App\Extraction\ExtractionException;
use App\Extraction\InvoiceExtractor;
use App\Models\Bill;
use App\Models\BillExtraction;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Throwable;

/**
 * Reads one uploaded supplier invoice in the background (the AI call takes
 * 5–30 seconds, far too long to hold an HTTP request open behind CloudFront).
 *
 * upload → images → AI → normalise + cross-check → duplicate check → result for review.
 * The uploaded file is deleted from the row whatever happens.
 */
class ExtractBill implements ShouldQueue
{
    use Queueable;

    /** Each attempt is an AI call against a daily quota: never retry automatically. */
    public int $tries = 1;

    /** Rendering + up to two HTTP attempts. Keep below the queue's retry_after (DB_QUEUE_RETRY_AFTER). */
    public int $timeout = 150;

    public function __construct(public string $extractionId) {}

    public function handle(InvoiceExtractor $extractor, DocumentPages $documentPages, BillExtractionNormalizer $normalizer): void
    {
        $extraction = BillExtraction::query()->find($this->extractionId);
        if ($extraction === null || $extraction->status !== ExtractionStatus::Pending) {
            return; // deleted, or already handled
        }

        $extraction->forceFill(['status' => ExtractionStatus::Processing])->save();
        $startedAt = hrtime(true);

        try {
            $maxPages = (int) config('invoiceflow.extraction.max_pages');
            $document = $documentPages->fromUpload(
                (string) base64_decode((string) $extraction->file_contents, true),
                $extraction->mime,
                $maxPages,
            );

            $answer = $extractor->extract($document['pages']);

            if (($answer['data']['is_invoice'] ?? true) === false) {
                throw ExtractionException::notAnInvoice();
            }

            ['result' => $result, 'warnings' => $warnings] = $normalizer->normalize($answer['data'], today()->toDateString());

            if ($document['total_pages'] > count($document['pages'])) {
                array_unshift($warnings, [
                    'field' => 'document',
                    'message' => "Only the first {$maxPages} of {$document['total_pages']} pages were read. Check the remaining lines by hand.",
                ]);
            }

            $result['duplicate_bill_id'] = $this->findDuplicate($extraction, $result);
            if ($result['duplicate_bill_id'] !== null) {
                $warnings[] = [
                    'field' => 'supplier_invoice_number',
                    'message' => 'You’ve already recorded this invoice number from this supplier. Saving it again would claim its VAT twice.',
                ];
            }

            $extraction->markCompleted($result, $warnings, $answer['model'], $this->elapsedMs($startedAt));
        } catch (ExtractionException $exception) {
            $extraction->markFailed($exception->getMessage(), $this->elapsedMs($startedAt));
        } catch (Throwable $exception) {
            $extraction->markFailed('Something went wrong reading this invoice. Please try again, or enter the bill by hand.', $this->elapsedMs($startedAt));
            report($exception);
        }
    }

    /** Killed by the timeout, or the worker died: don't leave the user polling, and don't keep the file. */
    public function failed(?Throwable $exception): void
    {
        $extraction = BillExtraction::query()->find($this->extractionId);

        if ($extraction !== null && ! $extraction->status->isFinished()) {
            $extraction->markFailed('Reading the invoice took too long. Please try again, or enter the bill by hand.');
        }
    }

    /** @param array<string, mixed> $result */
    private function findDuplicate(BillExtraction $extraction, array $result): ?int
    {
        if ($result['supplier_name'] === null || $result['supplier_invoice_number'] === null) {
            return null;
        }

        // Same rule as BillRequest's unique check (supplier name + number, per user).
        return Bill::query()
            ->where('user_id', $extraction->user_id)
            ->where('supplier_name', $result['supplier_name'])
            ->where('supplier_invoice_number', $result['supplier_invoice_number'])
            ->value('id');
    }

    private function elapsedMs(int|float $startedAt): int
    {
        return (int) round((hrtime(true) - $startedAt) / 1_000_000);
    }
}
