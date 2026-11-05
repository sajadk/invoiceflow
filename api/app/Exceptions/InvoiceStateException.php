<?php

namespace App\Exceptions;

use Illuminate\Contracts\Debug\ShouldntReport;
use Illuminate\Http\JsonResponse;
use RuntimeException;

/**
 * Thrown when an action isn't allowed in the invoice's current status
 * (e.g. editing a sent invoice). Laravel calls render() automatically,
 * so the API answers 409 Conflict with a readable message.
 *
 * ShouldntReport: this is an expected outcome, not a bug, so it isn't
 * written to the error log (or sent to Sentry), just like a 422.
 */
class InvoiceStateException extends RuntimeException implements ShouldntReport
{
    public function render(): JsonResponse
    {
        return response()->json(['message' => $this->getMessage()], 409);
    }
}