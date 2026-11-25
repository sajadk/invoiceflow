<?php

namespace App\Policies;

use App\Models\BillExtraction;
use App\Models\User;
use Illuminate\Auth\Access\Response;

class BillExtractionPolicy
{
    public function view(User $user, BillExtraction $extraction): Response
    {
        return $extraction->user()->is($user) ? Response::allow() : Response::denyAsNotFound();
    }
}
