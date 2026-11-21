<?php

namespace App\Policies;

use App\Models\Bill;
use App\Models\User;
use Illuminate\Auth\Access\Response;

class BillPolicy
{
    public function view(User $user, Bill $bill): Response
    {
        return $this->owns($user, $bill);
    }

    public function update(User $user, Bill $bill): Response
    {
        return $this->owns($user, $bill);
    }

    public function delete(User $user, Bill $bill): Response
    {
        return $this->owns($user, $bill);
    }

    private function owns(User $user, Bill $bill): Response
    {
        return $bill->user()->is($user) ? Response::allow() : Response::denyAsNotFound();
    }
}
