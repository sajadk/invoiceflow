<?php

namespace App\Exceptions;

use Illuminate\Http\JsonResponse;
use RuntimeException;

/**
 * Thrown when an action isn't allowed in the invoice's current status
 * (e.g. editing a sent invoice). Laravel calls render() automatically,
 * so the API answers 409 Conflict with a readable message.
 */
class InvoiceStateException extends RuntimeException
{
    public function render(): JsonResponse
    {
        return response()->json(['message' => $this->getMessage()], 409);
    }
}
