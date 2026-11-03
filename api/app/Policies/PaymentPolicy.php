<?php

namespace App\Policies;

use App\Models\Payment;
use App\Models\User;
use Illuminate\Auth\Access\Response;

class PaymentPolicy
{
    public function delete(User $user, Payment $payment): Response
    {
        return $payment->user()->is($user)
            ? Response::allow()
            : Response::denyAsNotFound();
    }
}
