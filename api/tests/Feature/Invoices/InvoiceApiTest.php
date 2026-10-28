<?php

namespace Tests\Feature\Invoices;

use App\Models\Customer;
use App\Models\Invoice;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

class InvoiceApiTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    private Customer $customer;

    protected function setUp(): void
    {
        parent::setUp();

        Carbon::setTestNow('2026-03-15 10:00:00');
        $this->user = User::factory()->create();
        $this->customer = Customer::factory()->for($this->user)->create(['name' => 'Al Noor Trading LLC', 'trn' => '100123456789012']);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function payload(array $overrides = []): array
    {
        return [
            'customer_id' => $this->customer->id,
            'issue_date' => '2026-03-15',
            'due_date' => '2026-04-14',
            'notes' => 'Thank you!',
            'items' => [
                ['description' => 'Website maintenance', 'quantity' => 1, 'unit_price' => 150000, 'vat_rate' => 'standard'],
                ['description' => 'Consulting', 'quantity' => '2.5', 'unit_price' => 40000, 'vat_rate' => 'standard'],
                ['description' => 'Export handling', 'quantity' => 1, 'unit_price' => 50000, 'vat_rate' => 'zero'],
            ],
            ...$overrides,
        ];
    }

    private function createDraft(array $overrides = []): TestResponse
    {
        return $this->actingAs($this->user)->postJson('/api/invoices', $this->payload($overrides));
    }

    private function sentInvoice(array $overrides = []): Invoice
    {
        $id = $this->createDraft($overrides)->json('data.id');
        $this->actingAs($this->user)->postJson("/api/invoices/{$id}/send")->assertOk();

        return Invoice::findOrFail($id);
    }

    // --- Create / totals ---------------------------------------------------

    public function test_creating_a_draft_calculates_totals_on_the_server(): void
    {
        $this->createDraft(['subtotal' => 1, 'total' => 1]) // client-sent totals are ignored
            ->assertCreated()
            ->assertJsonPath('data.status', 'draft')
            ->assertJsonPath('data.number', null)
            ->assertJsonPath('data.subtotal', 300000)   // 1,500 + 1,000 + 500
            ->assertJsonPath('data.vat_total', 12500)   // 5% of 2,500 (standard lines only)
            ->assertJsonPath('data.total', 312500)
            ->assertJsonPath('data.items.1.quantity', '2.500')
            ->assertJsonPath('data.items.1.line_total', 100000)
            ->assertJsonPath('data.vat_breakdown.0.rate', 'standard')
            ->assertJsonPath('data.vat_breakdown.0.taxable', 250000)
            ->assertJsonPath('data.vat_breakdown.1.rate', 'zero')
            ->assertJsonPath('data.customer.name', 'Al Noor Trading LLC');
    }

    public function test_validation_errors(): void
    {
        $this->createDraft([
            'due_date' => '2026-03-01',
            'items' => [['description' => '', 'quantity' => 0, 'unit_price' => -5, 'vat_rate' => 'luxury']],
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors([
                'due_date',
                'items.0.description',
                'items.0.quantity',
                'items.0.unit_price',
                'items.0.vat_rate',
            ]);

        $this->createDraft(['items' => []])->assertUnprocessable()->assertJsonValidationErrors(['items']);
    }

    public function test_cannot_invoice_another_users_customer(): void
    {
        $theirs = Customer::factory()->create();

        $this->createDraft(['customer_id' => $theirs->id])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['customer_id' => 'Choose one of your customers.']);
    }

    // --- Update / delete drafts ---------------------------------------------

    public function test_updating_a_draft_replaces_its_items(): void
    {
        $id = $this->createDraft()->json('data.id');

        $this->actingAs($this->user)
            ->putJson("/api/invoices/{$id}", $this->payload([
                'items' => [['description' => 'Single line', 'quantity' => 3, 'unit_price' => 10000, 'vat_rate' => 'standard']],
            ]))
            ->assertOk()
            ->assertJsonCount(1, 'data.items')
            ->assertJsonPath('data.total', 31500);

        $this->assertDatabaseCount('invoice_items', 1);
    }

    public function test_drafts_can_be_deleted(): void
    {
        $id = $this->createDraft()->json('data.id');

        $this->actingAs($this->user)->deleteJson("/api/invoices/{$id}")->assertNoContent();

        $this->assertDatabaseMissing('invoices', ['id' => $id]);
        $this->assertDatabaseCount('invoice_items', 0);
    }

    // --- Sending ------------------------------------------------------------

    public function test_sending_assigns_sequential_numbers_and_freezes_customer_details(): void
    {
        $first = $this->sentInvoice();
        $second = $this->sentInvoice();

        $this->assertSame('INV-2026-0001', $first->number);
        $this->assertSame('INV-2026-0002', $second->number);
        $this->assertSame('100123456789012', $first->billed_to['trn']);

        // Renaming the customer later doesn't change an issued invoice.
        $this->customer->update(['name' => 'Renamed LLC']);
        $this->actingAs($this->user)
            ->getJson("/api/invoices/{$first->id}")
            ->assertJsonPath('data.billed_to.name', 'Al Noor Trading LLC')
            ->assertJsonPath('data.status', 'sent');
    }

    public function test_numbering_is_per_user(): void
    {
        $this->sentInvoice();

        $otherUser = User::factory()->create();
        $otherCustomer = Customer::factory()->for($otherUser)->create();
        $id = $this->actingAs($otherUser)
            ->postJson('/api/invoices', $this->payload(['customer_id' => $otherCustomer->id]))
            ->json('data.id');

        $this->actingAs($otherUser)
            ->postJson("/api/invoices/{$id}/send")
            ->assertJsonPath('data.number', 'INV-2026-0001');
    }

    public function test_sent_invoices_are_locked(): void
    {
        $invoice = $this->sentInvoice();

        $this->actingAs($this->user)->putJson("/api/invoices/{$invoice->id}", $this->payload())
            ->assertStatus(409)
            ->assertJsonPath('message', 'Only draft invoices can be edited.');

        $this->actingAs($this->user)->deleteJson("/api/invoices/{$invoice->id}")->assertStatus(409);
        $this->actingAs($this->user)->postJson("/api/invoices/{$invoice->id}/send")->assertStatus(409);
    }

    // --- Paid / void / overdue ------------------------------------------------

    public function test_sent_invoice_can_be_marked_paid(): void
    {
        $invoice = $this->sentInvoice();

        $this->actingAs($this->user)
            ->postJson("/api/invoices/{$invoice->id}/mark-paid")
            ->assertOk()
            ->assertJsonPath('data.status', 'paid');

        $this->actingAs($this->user)->postJson("/api/invoices/{$invoice->id}/void")->assertStatus(409);
    }

    public function test_drafts_cannot_be_paid_or_voided(): void
    {
        $id = $this->createDraft()->json('data.id');

        $this->actingAs($this->user)->postJson("/api/invoices/{$id}/mark-paid")->assertStatus(409);
        $this->actingAs($this->user)->postJson("/api/invoices/{$id}/void")->assertStatus(409);
    }

    public function test_sent_invoice_can_be_voided(): void
    {
        $invoice = $this->sentInvoice();

        $this->actingAs($this->user)
            ->postJson("/api/invoices/{$invoice->id}/void")
            ->assertOk()
            ->assertJsonPath('data.status', 'void');
    }

    public function test_overdue_is_derived_from_the_due_date(): void
    {
        $overdue = $this->sentInvoice(['issue_date' => '2026-01-01', 'due_date' => '2026-01-31']);
        $current = $this->sentInvoice(); // due 2026-04-14
        $this->createDraft(['issue_date' => '2026-01-01', 'due_date' => '2026-01-31']); // drafts are never overdue

        $this->actingAs($this->user)
            ->getJson("/api/invoices/{$overdue->id}")
            ->assertJsonPath('data.status', 'sent')
            ->assertJsonPath('data.display_status', 'overdue')
            ->assertJsonPath('data.is_overdue', true);

        $this->actingAs($this->user)
            ->getJson('/api/invoices?status=overdue')
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $overdue->id);

        $this->actingAs($this->user)
            ->getJson("/api/invoices/{$current->id}")
            ->assertJsonPath('data.display_status', 'sent');
    }

    // --- Listing ------------------------------------------------------------

    public function test_index_lists_own_invoices_with_search(): void
    {
        $this->sentInvoice();
        $this->createDraft();
        Customer::factory()->create(); // other user's data shouldn't leak

        $this->actingAs($this->user)->getJson('/api/invoices')
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonMissingPath('data.0.items'); // items only on the detail endpoint

        $this->actingAs($this->user)->getJson('/api/invoices?search=INV-2026-0001')->assertJsonCount(1, 'data');
        $this->actingAs($this->user)->getJson('/api/invoices?search=noor')->assertJsonCount(2, 'data');
        $this->actingAs($this->user)->getJson('/api/invoices?status=draft')->assertJsonCount(1, 'data');
    }

    public function test_other_users_invoices_are_not_found(): void
    {
        $id = $this->createDraft()->json('data.id');
        $stranger = User::factory()->create();

        $this->actingAs($stranger)->getJson("/api/invoices/{$id}")->assertNotFound();
        $this->actingAs($stranger)->putJson("/api/invoices/{$id}", [])->assertNotFound();
        $this->actingAs($stranger)->postJson("/api/invoices/{$id}/send")->assertNotFound();
        $this->actingAs($stranger)->getJson("/api/invoices/{$id}/pdf")->assertNotFound();
    }

    public function test_pdf_download(): void
    {
        $invoice = $this->sentInvoice();

        $this->actingAs($this->user)
            ->get("/api/invoices/{$invoice->id}/pdf")
            ->assertOk()
            ->assertHeader('content-type', 'application/pdf')
            ->assertDownload('INV-2026-0001.pdf');
    }
}
