<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\Concerns\MakesSpaRequests;
use Tests\TestCase;

class RegisterTest extends TestCase
{
    use MakesSpaRequests;
    use RefreshDatabase;

    public function test_new_user_can_register_and_is_logged_in(): void
    {
        $this->fromSpa()
            ->postJson('/api/register', [
                'name' => 'Omar Al Mansoori',
                'email' => 'Omar@Example.AE',
                'password' => 'secret-password',
                'password_confirmation' => 'secret-password',
            ])
            ->assertCreated()
            ->assertJsonPath('data.name', 'Omar Al Mansoori')
            ->assertJsonPath('data.email', 'omar@example.ae');

        $user = User::where('email', 'omar@example.ae')->firstOrFail();

        $this->assertTrue(Hash::check('secret-password', $user->password));
        $this->assertAuthenticatedAs($user, 'web');
    }

    public function test_email_must_be_unique(): void
    {
        User::factory()->create(['email' => 'omar@example.ae']);

        $this->fromSpa()
            ->postJson('/api/register', [
                'name' => 'Omar',
                'email' => 'OMAR@example.ae',
                'password' => 'secret-password',
                'password_confirmation' => 'secret-password',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['email']);
    }

    public function test_password_must_be_confirmed_and_long_enough(): void
    {
        $this->fromSpa()
            ->postJson('/api/register', [
                'name' => 'Omar',
                'email' => 'omar@example.ae',
                'password' => 'short',
                'password_confirmation' => 'different',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['password']);

        $this->assertGuest('web');
    }
}
