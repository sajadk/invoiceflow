<?php

namespace Tests\Feature\Customers;

use App\Models\Customer;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CustomerApiTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::factory()->create();
    }

    private function validPayload(array $overrides = []): array
    {
        return [
            'name' => 'Al Noor Trading LLC',
            'email' => 'accounts@alnoor.ae',
            'phone' => '+971 50 123 4567',
            'trn' => '100123456789012',
            'emirate' => 'dubai',
            'address' => 'Office 1204, Business Bay',
            ...$overrides,
        ];
    }

    // --- Index -------------------------------------------------------------

    public function test_guests_cannot_list_customers(): void
    {
        $this->getJson('/api/customers')->assertUnauthorized();
    }

    public function test_index_only_returns_the_users_own_customers(): void
    {
        Customer::factory()->count(3)->for($this->user)->create();
        Customer::factory()->count(2)->create(); // someone else's

        $this->actingAs($this->user)
            ->getJson('/api/customers')
            ->assertOk()
            ->assertJsonCount(3, 'data')
            ->assertJsonPath('meta.total', 3)
            ->assertJsonStructure([
                'data' => [['id', 'name', 'email', 'phone', 'trn', 'emirate', 'emirate_label', 'address', 'created_at']],
                'meta' => ['current_page', 'last_page', 'per_page', 'total', 'from', 'to'],
                'links',
            ]);
    }

    public function test_index_is_paginated(): void
    {
        Customer::factory()->count(12)->for($this->user)->create();

        $this->actingAs($this->user)
            ->getJson('/api/customers?per_page=5&page=3')
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('meta.current_page', 3)
            ->assertJsonPath('meta.last_page', 3);
    }

    public function test_index_searches_name_email_and_trn(): void
    {
        Customer::factory()->for($this->user)->create(['name' => 'Emirates Steel Trading', 'email' => null, 'trn' => null]);
        Customer::factory()->for($this->user)->create(['name' => 'Blue Wave LLC', 'email' => 'hello@steelworks.ae', 'trn' => null]);
        Customer::factory()->for($this->user)->create(['name' => 'Gulf Foods', 'email' => null, 'trn' => '100999888777666']);
        Customer::factory()->for($this->user)->create(['name' => 'Unrelated FZE', 'email' => null, 'trn' => null]);

        $this->actingAs($this->user)->getJson('/api/customers?search=steel')
            ->assertOk()->assertJsonCount(2, 'data');

        $this->actingAs($this->user)->getJson('/api/customers?search=999888')
            ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.name', 'Gulf Foods');
    }

    public function test_index_filters_by_emirate_and_sorts(): void
    {
        Customer::factory()->for($this->user)->create(['name' => 'Bravo', 'emirate' => 'dubai']);
        Customer::factory()->for($this->user)->create(['name' => 'Alpha', 'emirate' => 'dubai']);
        Customer::factory()->for($this->user)->create(['name' => 'Charlie', 'emirate' => 'sharjah']);

        $this->actingAs($this->user)
            ->getJson('/api/customers?emirate=dubai&sort=-name')
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.name', 'Bravo')
            ->assertJsonPath('data.1.name', 'Alpha');
    }

    public function test_index_rejects_unknown_sort_columns(): void
    {
        $this->actingAs($this->user)
            ->getJson('/api/customers?sort=password')
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['sort']);
    }

    // --- Store -------------------------------------------------------------

    public function test_user_can_create_a_customer(): void
    {
        $this->actingAs($this->user)
            ->postJson('/api/customers', $this->validPayload(['trn' => '100-1234-5678-9012']))
            ->assertCreated()
            ->assertJsonPath('data.name', 'Al Noor Trading LLC')
            ->assertJsonPath('data.trn', '100123456789012') // dashes stripped
            ->assertJsonPath('data.emirate', 'dubai')
            ->assertJsonPath('data.emirate_label', 'Dubai');

        $this->assertDatabaseHas('customers', [
            'user_id' => $this->user->id,
            'name' => 'Al Noor Trading LLC',
            'trn' => '100123456789012',
        ]);
    }

    public function test_only_name_is_required(): void
    {
        $this->actingAs($this->user)
            ->postJson('/api/customers', ['name' => 'Walk-in Customer'])
            ->assertCreated()
            ->assertJsonPath('data.trn', null);
    }

    public function test_user_id_in_the_payload_is_ignored(): void
    {
        $other = User::factory()->create();

        $this->actingAs($this->user)
            ->postJson('/api/customers', $this->validPayload(['user_id' => $other->id]))
            ->assertCreated();

        $this->assertDatabaseHas('customers', ['user_id' => $this->user->id]);
        $this->assertDatabaseMissing('customers', ['user_id' => $other->id]);
    }

    public function test_store_validates_input(): void
    {
        $this->actingAs($this->user)
            ->postJson('/api/customers', [
                'name' => '',
                'email' => 'not-an-email',
                'trn' => '12345',
                'emirate' => 'paris',
                'phone' => 'call me',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['name', 'email', 'trn', 'emirate', 'phone']);
    }

    public function test_trn_must_start_with_100(): void
    {
        $this->actingAs($this->user)
            ->postJson('/api/customers', $this->validPayload(['trn' => '200123456789012']))
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['trn' => 'UAE TRNs start with 100.']);
    }

    public function test_trn_is_unique_per_user_but_not_globally(): void
    {
        Customer::factory()->for($this->user)->create(['trn' => '100123456789012']);
        Customer::factory()->create(['trn' => '100555555555555']); // other user's

        $this->actingAs($this->user)
            ->postJson('/api/customers', $this->validPayload(['trn' => '100123456789012']))
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['trn']);

        $this->actingAs($this->user)
            ->postJson('/api/customers', $this->validPayload(['trn' => '100555555555555']))
            ->assertCreated();
    }

    // --- Show / update / delete -------------------------------------------

    public function test_user_can_view_update_and_delete_their_customer(): void
    {
        $customer = Customer::factory()->for($this->user)->create(['trn' => '100123456789012']);

        $this->actingAs($this->user)
            ->getJson("/api/customers/{$customer->id}")
            ->assertOk()
            ->assertJsonPath('data.id', $customer->id);

        // Re-saving with its own TRN must not trip the unique rule.
        $this->actingAs($this->user)
            ->putJson("/api/customers/{$customer->id}", $this->validPayload(['name' => 'Renamed LLC']))
            ->assertOk()
            ->assertJsonPath('data.name', 'Renamed LLC');

        $this->actingAs($this->user)
            ->deleteJson("/api/customers/{$customer->id}")
            ->assertNoContent();

        $this->assertSoftDeleted($customer);
        $this->actingAs($this->user)->getJson("/api/customers/{$customer->id}")->assertNotFound();
    }

    public function test_other_users_customers_are_not_found(): void
    {
        $theirs = Customer::factory()->create();

        $this->actingAs($this->user)->getJson("/api/customers/{$theirs->id}")->assertNotFound();
        // 404 even with an invalid payload: ownership is checked before validation.
        $this->actingAs($this->user)->putJson("/api/customers/{$theirs->id}", ['name' => ''])->assertNotFound();
        $this->actingAs($this->user)->deleteJson("/api/customers/{$theirs->id}")->assertNotFound();

        $this->assertNotSoftDeleted($theirs);
    }
}
