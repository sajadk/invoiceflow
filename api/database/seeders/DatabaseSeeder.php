<?php

namespace Database\Seeders;

use App\Models\Customer;
use App\Models\User;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Demo account shown on the login page so reviewers can try the app without registering.
     * Safe to re-run: only adds sample data the first time.
     */
    public function run(): void
    {
        $demo = User::updateOrCreate(
            ['email' => 'demo@invoiceflow.test'],
            ['name' => 'Demo User', 'password' => 'password'],
        );

        if (! Customer::whereBelongsTo($demo)->exists()) {
            Customer::factory()->count(32)->for($demo)->create();
        }
    }
}
