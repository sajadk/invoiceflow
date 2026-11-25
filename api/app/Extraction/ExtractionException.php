<?php

namespace App\Extraction;

use RuntimeException;

/**
 * Something went wrong reading a document. The message is written for the
 * user (it's stored on the extraction and shown in the UI), so it never
 * contains provider responses, keys or stack traces.
 */
class ExtractionException extends RuntimeException
{
    public static function unreadablePdf(): self
    {
        return new self('This PDF couldn’t be opened. If it’s password-protected, upload a screenshot or photo instead.');
    }

    public static function notAnInvoice(): self
    {
        return new self('This doesn’t look like an invoice. Upload a supplier invoice, or enter the bill by hand.');
    }

    public static function unreadableAnswer(): self
    {
        return new self('The AI’s answer couldn’t be read. Please try again, or enter the bill by hand.');
    }

    public static function serviceMisconfigured(): self
    {
        return new self('The AI service rejected this server’s credentials. Please enter the bill by hand.');
    }

    public static function quotaExhausted(): self
    {
        return new self('The AI service is busy or its free quota is used up. Please try again later.');
    }

    public static function serviceUnavailable(): self
    {
        return new self('The AI service didn’t respond. Please try again in a minute.');
    }
}
