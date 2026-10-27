<?php

namespace Tests\Feature\Auth;

use App\Http\Requests\Auth\LoginRequest;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\MakesSpaRequests;
use Tests\TestCase;

class LoginTest extends TestCase
{
    use MakesSpaRequests;
    use RefreshDatabase;

    public function test_user_can_log_in_with_valid_credentials(): void
    {
        $user = User::factory()->create(['email' => 'sara@example.ae']);

        $this->fromSpa()
            ->postJson('/api/login', ['email' => 'sara@example.ae', 'password' => 'password'])
            ->assertOk()
            ->assertJsonPath('data.id', $user->id)
            ->assertJsonPath('data.email', 'sara@example.ae')
            ->assertJsonMissingPath('data.password');

        $this->assertAuthenticatedAs($user, 'web');
    }

    public function test_login_fails_with_wrong_password(): void
    {
        User::factory()->create(['email' => 'sara@example.ae']);

        $this->fromSpa()
            ->postJson('/api/login', ['email' => 'sara@example.ae', 'password' => 'wrong-password'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['email']);

        $this->assertGuest('web');
    }

    public function test_login_requires_email_and_password(): void
    {
        $this->fromSpa()
            ->postJson('/api/login', [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['email', 'password']);
    }

    public function test_login_is_rate_limited_after_repeated_failures(): void
    {
        User::factory()->create(['email' => 'sara@example.ae']);

        for ($i = 0; $i < LoginRequest::MAX_ATTEMPTS; $i++) {
            $this->fromSpa()->postJson('/api/login', ['email' => 'sara@example.ae', 'password' => 'wrong']);
        }

        // Even the correct password is refused while locked out.
        $response = $this->fromSpa()
            ->postJson('/api/login', ['email' => 'sara@example.ae', 'password' => 'password'])
            ->assertUnprocessable();

        $this->assertStringContainsString('Too many', $response->json('errors.email.0'));
        $this->assertGuest('web');
    }
}
