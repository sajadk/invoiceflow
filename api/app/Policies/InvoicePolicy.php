<?php

namespace App\Policies;

use App\Models\Invoice;
use App\Models\User;
use Illuminate\Auth\Access\Response;

/**
 * Ownership only. Whether an action fits the invoice's *status* (e.g. editing a
 * sent invoice) is a business rule, answered with 409 by InvoiceStateException.
 */
class InvoicePolicy
{
    public function view(User $user, Invoice $invoice): Response
    {
        return $this->owns($user, $invoice);
    }

    public function update(User $user, Invoice $invoice): Response
    {
        return $this->owns($user, $invoice);
    }

    public function delete(User $user, Invoice $invoice): Response
    {
        return $this->owns($user, $invoice);
    }

    private function owns(User $user, Invoice $invoice): Response
    {
        return $invoice->user()->is($user)
            ? Response::allow()
            : Response::denyAsNotFound();
    }
}
