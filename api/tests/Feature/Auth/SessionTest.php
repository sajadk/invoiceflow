<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\MakesSpaRequests;
use Tests\TestCase;

class SessionTest extends TestCase
{
    use MakesSpaRequests;
    use RefreshDatabase;

    public function test_authenticated_user_can_fetch_their_profile(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->getJson('/api/user')
            ->assertOk()
            ->assertJsonPath('data.id', $user->id)
            ->assertJsonStructure(['data' => ['id', 'name', 'email', 'created_at']]);
    }

    public function test_guest_gets_401_from_protected_routes(): void
    {
        $this->getJson('/api/user')->assertUnauthorized();
        $this->postJson('/api/logout')->assertUnauthorized();
    }

    public function test_user_can_log_out(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->fromSpa()
            ->postJson('/api/logout')
            ->assertNoContent();

        $this->assertGuest('web');
    }
}
