<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Demo account shown on the login page so reviewers can try the app without registering.
     */
    public function run(): void
    {
        User::updateOrCreate(
            ['email' => 'demo@invoiceflow.test'],
            ['name' => 'Demo User', 'password' => 'password'],
        );
    }
}
