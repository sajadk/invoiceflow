<?php

namespace App\Extraction;

/**
 * Reads invoice images and returns the raw fields the model saw, in the
 * shape described by ExtractionPrompt. Nothing here is trusted yet:
 * BillExtractionNormalizer validates and cross-checks it.
 */
interface InvoiceExtractor
{
    /**
     * @param  list<DocumentPage>  $pages
     * @return array{data: array<string, mixed>, model: string}
     *
     * @throws ExtractionException
     */
    public function extract(array $pages): array;
}
