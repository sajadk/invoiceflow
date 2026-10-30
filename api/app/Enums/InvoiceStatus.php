<?php

namespace App\Enums;

/**
 * Stored statuses. "Overdue" is not stored: it's derived (sent + past due date),
 * so it can never go stale and needs no nightly job.
 *
 *   draft ──send──▶ sent ──mark paid──▶ paid
 *                     └────void──────▶ void
 */
enum InvoiceStatus: string
{
    case Draft = 'draft';
    case Sent = 'sent';
    case Paid = 'paid';
    case Void = 'void';
}
