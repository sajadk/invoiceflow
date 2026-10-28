<?php

namespace App\Policies;

use App\Models\Customer;
use App\Models\User;
use Illuminate\Auth\Access\Response;

/**
 * Auto-discovered by Laravel (App\Models\Customer → App\Policies\CustomerPolicy).
 *
 * Another user's customer answers 404, not 403: a 403 would confirm that the ID exists.
 */
class CustomerPolicy
{
    public function view(User $user, Customer $customer): Response
    {
        return $this->owns($user, $customer);
    }

    public function update(User $user, Customer $customer): Response
    {
        return $this->owns($user, $customer);
    }

    public function delete(User $user, Customer $customer): Response
    {
        return $this->owns($user, $customer);
    }

    private function owns(User $user, Customer $customer): Response
    {
        return $customer->user()->is($user)
            ? Response::allow()
            : Response::denyAsNotFound();
    }
}
