<?php

namespace Database\Factories;

use App\Enums\Emirate;
use App\Models\Customer;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Customer>
 */
class CustomerFactory extends Factory
{
    protected $model = Customer::class;

    private const SUFFIXES = ['LLC', 'Trading LLC', 'FZE', 'FZ-LLC', 'General Trading', 'Technical Services LLC'];

    public function definition(): array
    {
        $company = fake()->unique()->lastName().' '.fake()->randomElement(self::SUFFIXES);

        return [
            'user_id' => User::factory(),
            'name' => $company,
            'email' => fake()->boolean(85) ? 'accounts@'.str($company)->slug()->limit(20, '')->rtrim('-').'.ae' : null,
            'phone' => fake()->boolean(80) ? '+9715'.fake()->numerify('########') : null,
            'trn' => fake()->boolean(75) ? fake()->numerify('100############') : null,
            'emirate' => fake()->randomElement(Emirate::cases()),
            'address' => fake()->boolean(70) ? fake()->buildingNumber().' '.fake()->streetName() : null,
        ];
    }

    /** A customer that isn't VAT-registered. */
    public function withoutTrn(): static
    {
        return $this->state(fn () => ['trn' => null]);
    }
}
