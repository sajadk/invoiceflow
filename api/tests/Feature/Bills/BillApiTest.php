<?php

namespace Tests\Feature\Bills;

use App\Models\Bill;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

class BillApiTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();

        Carbon::setTestNow('2026-03-15 10:00:00');
        $this->user = User::factory()->create();
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function payload(array $overrides = []): array
    {
        return [
            'supplier_name' => 'Example Office Supplies LLC',
            'supplier_trn' => '100-0000-0001-2345',
            'supplier_invoice_number' => 'SI-1001',
            'issue_date' => '2026-03-10',
            'due_date' => '2026-04-09',
            'notes' => null,
            'items' => [
                ['description' => 'Office supplies', 'quantity' => 2, 'unit_price' => 42000, 'vat_rate' => 'standard'],
                ['description' => 'International freight', 'quantity' => 1, 'unit_price' => 180000, 'vat_rate' => 'zero'],
            ],
            ...$overrides,
        ];
    }

    private function create(array $overrides = [], ?User $as = null): TestResponse
    {
        return $this->actingAs($as ?? $this->user)->postJson('/api/bills', $this->payload($overrides));
    }

    public function test_recording_a_bill_calculates_totals_on_the_server(): void
    {
        $this->create(['total' => 1])
            ->assertCreated()
            ->assertJsonPath('data.supplier_trn', '100000000012345') // dashes stripped
            ->assertJsonPath('data.status', 'unpaid')
            ->assertJsonPath('data.subtotal', 264000)  // 840 + 1,800
            ->assertJsonPath('data.vat_total', 4200)   // 5% of 840 only
            ->assertJsonPath('data.total', 268200)
            ->assertJsonPath('data.vat_breakdown.1.rate', 'zero')
            ->assertJsonCount(2, 'data.items');
    }

    public function test_validation(): void
    {
        $this->create([
            'supplier_name' => '',
            'supplier_trn' => '12345',
            'supplier_invoice_number' => '',
            'issue_date' => '2026-03-20', // in the future
            'items' => [],
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['supplier_name', 'supplier_trn', 'supplier_invoice_number', 'issue_date', 'items']);

        $this->create(['due_date' => '2026-03-01'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['due_date']);
    }

    public function test_trn_and_due_date_are_optional(): void
    {
        $this->create(['supplier_trn' => null, 'due_date' => ''])
            ->assertCreated()
            ->assertJsonPath('data.supplier_trn', null)
            ->assertJsonPath('data.due_date', null)
            ->assertJsonPath('data.is_overdue', false);
    }

    public function test_the_same_supplier_invoice_cannot_be_recorded_twice(): void
    {
        $this->create()->assertCreated();

        $this->create()
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['supplier_invoice_number' => 'You’ve already recorded this invoice number from this supplier.']);

        // Same number from a different supplier, or for another user, is fine.
        $this->create(['supplier_name' => 'Sample Cloud Hosting FZ-LLC'])->assertCreated();
        $this->create([], User::factory()->create())->assertCreated();
    }

    public function test_unpaid_bills_can_be_edited_and_deleted(): void
    {
        $id = $this->create()->json('data.id');

        // Keeping its own number must not trip the duplicate rule.
        $this->actingAs($this->user)
            ->putJson("/api/bills/{$id}", $this->payload([
                'items' => [['description' => 'Supplies', 'quantity' => 1, 'unit_price' => 10000, 'vat_rate' => 'standard']],
            ]))
            ->assertOk()
            ->assertJsonPath('data.total', 10500);

        $this->actingAs($this->user)->deleteJson("/api/bills/{$id}")->assertNoContent();
        $this->assertDatabaseMissing('bills', ['id' => $id]);
        $this->assertDatabaseCount('bill_items', 0);
    }

    public function test_paid_bills_are_locked_until_marked_unpaid(): void
    {
        $id = $this->create()->json('data.id');

        $this->actingAs($this->user)->postJson("/api/bills/{$id}/mark-paid")
            ->assertOk()
            ->assertJsonPath('data.status', 'paid');

        $this->actingAs($this->user)->putJson("/api/bills/{$id}", $this->payload())->assertStatus(409);
        $this->actingAs($this->user)->deleteJson("/api/bills/{$id}")->assertStatus(409);
        $this->actingAs($this->user)->postJson("/api/bills/{$id}/mark-paid")->assertStatus(409);

        $this->actingAs($this->user)->postJson("/api/bills/{$id}/mark-unpaid")
            ->assertOk()
            ->assertJsonPath('data.status', 'unpaid');
        $this->assertNull(Bill::find($id)->paid_at);
    }

    public function test_overdue_is_derived_and_filterable(): void
    {
        $this->create(['supplier_invoice_number' => 'OLD', 'issue_date' => '2026-01-10', 'due_date' => '2026-02-09']);
        $this->create(['supplier_invoice_number' => 'NEW']); // due 2026-04-09
        $this->create(['supplier_invoice_number' => 'NODUE', 'issue_date' => '2026-01-10', 'due_date' => null]);

        $this->actingAs($this->user)->getJson('/api/bills?status=overdue')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.supplier_invoice_number', 'OLD')
            ->assertJsonPath('data.0.display_status', 'overdue');

        $this->actingAs($this->user)->getJson('/api/bills?status=unpaid')->assertJsonCount(3, 'data');
    }

    public function test_index_lists_own_bills_with_search(): void
    {
        $this->create();
        $this->create(['supplier_name' => 'Demo Telecom Services LLC', 'supplier_invoice_number' => 'TEL-77', 'supplier_trn' => null]);
        $this->create([], User::factory()->create()); // someone else's

        $this->actingAs($this->user)->getJson('/api/bills')
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonMissingPath('data.0.items'); // items only on the detail endpoint

        $this->actingAs($this->user)->getJson('/api/bills?search=telecom')->assertJsonCount(1, 'data');
        $this->actingAs($this->user)->getJson('/api/bills?search=TEL-77')->assertJsonCount(1, 'data');
        $this->actingAs($this->user)->getJson('/api/bills?search=000012345')->assertJsonCount(1, 'data');
    }

    public function test_other_users_bills_are_not_found(): void
    {
        $id = $this->create()->json('data.id');
        $stranger = User::factory()->create();

        $this->actingAs($stranger)->getJson("/api/bills/{$id}")->assertNotFound();
        $this->actingAs($stranger)->putJson("/api/bills/{$id}", [])->assertNotFound();
        $this->actingAs($stranger)->deleteJson("/api/bills/{$id}")->assertNotFound();
        $this->actingAs($stranger)->postJson("/api/bills/{$id}/mark-paid")->assertNotFound();
    }
}
