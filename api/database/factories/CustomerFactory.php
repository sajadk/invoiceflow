<?php

namespace Database\Factories;

use App\Enums\Emirate;
use App\Models\Customer;
use App\Models\User;
use Database\Seeders\Data\DemoCompanies;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Customer>
 */
class CustomerFactory extends Factory
{
    protected $model = Customer::class;

    private const AREAS = ['Business Bay', 'Al Quoz', 'JLT', 'Deira', 'Al Nahda', 'Khalifa City', 'Mussafah', 'Al Majaz'];

    public function definition(): array
    {
        $company = fake()->randomElement(DemoCompanies::customers());

        return [
            'user_id' => User::factory(),
            'name' => $company,
            'email' => fake()->boolean(85) ? DemoCompanies::emailFor($company) : null,
            'phone' => fake()->boolean(80) ? '+9715'.fake()->numerify('########') : null,
            'trn' => fake()->boolean(75) ? DemoCompanies::sampleTrn() : null,
            'emirate' => fake()->randomElement(Emirate::cases()),
            'address' => fake()->boolean(70) ? 'Office '.fake()->numberBetween(101, 2405).', '.fake()->randomElement(self::AREAS) : null,
        ];
    }

    /** A customer that isn't VAT-registered. */
    public function withoutTrn(): static
    {
        return $this->state(fn () => ['trn' => null]);
    }
}
