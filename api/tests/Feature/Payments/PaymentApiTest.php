<?php

namespace Tests\Feature\Payments;

use App\Actions\Invoices\SaveDraftInvoice;
use App\Actions\Invoices\SendInvoice;
use App\Models\Customer;
use App\Models\Invoice;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

class PaymentApiTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    private Customer $customer;

    protected function setUp(): void
    {
        parent::setUp();

        Carbon::setTestNow('2026-03-15 10:00:00');
        $this->user = User::factory()->create();
        $this->customer = Customer::factory()->for($this->user)->create(['name' => 'Gulf Foods LLC']);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    /** A sent invoice for AED 1,050.00 (1,000 + 5% VAT). */
    private function sentInvoice(?User $owner = null, string $issueDate = '2026-03-01'): Invoice
    {
        $owner ??= $this->user;
        $customer = $owner->is($this->user) ? $this->customer : Customer::factory()->for($owner)->create();

        $draft = app(SaveDraftInvoice::class)->handle($owner, [
            'customer_id' => $customer->id,
            'issue_date' => $issueDate,
            'due_date' => '2026-03-31',
            'items' => [['description' => 'Consulting', 'quantity' => 1, 'unit_price' => 100000, 'vat_rate' => 'standard']],
        ]);

        return app(SendInvoice::class)->handle($draft);
    }

    private function pay(Invoice $invoice, array $overrides = []): TestResponse
    {
        return $this->actingAs($this->user)->postJson("/api/invoices/{$invoice->id}/payments", [
            'amount' => 40000,
            'paid_on' => '2026-03-10',
            'method' => 'bank_transfer',
            'reference' => 'FT123456',
            ...$overrides,
        ]);
    }

    public function test_partial_payment_reduces_the_balance(): void
    {
        $invoice = $this->sentInvoice();

        $this->pay($invoice)
            ->assertCreated()
            ->assertJsonPath('data.status', 'sent')
            ->assertJsonPath('data.display_status', 'partially_paid')
            ->assertJsonPath('data.amount_paid', 40000)
            ->assertJsonPath('data.balance_due', 65000)
            ->assertJsonCount(1, 'data.payments')
            ->assertJsonPath('data.payments.0.method_label', 'Bank transfer');
    }

    public function test_paying_the_remaining_balance_marks_the_invoice_paid(): void
    {
        $invoice = $this->sentInvoice();

        $this->pay($invoice)->assertCreated();
        $this->pay($invoice, ['amount' => 65000, 'method' => 'cheque'])
            ->assertCreated()
            ->assertJsonPath('data.status', 'paid')
            ->assertJsonPath('data.balance_due', 0)
            ->assertJsonCount(2, 'data.payments');

        $this->assertNotNull($invoice->refresh()->paid_at);

        // Fully paid: no more payments.
        $this->pay($invoice, ['amount' => 1])->assertStatus(409);
    }

    public function test_cannot_pay_more_than_the_balance(): void
    {
        $invoice = $this->sentInvoice();

        $this->pay($invoice, ['amount' => 105001])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['amount']);

        $this->assertDatabaseCount('payments', 0);
    }

    public function test_payment_validation(): void
    {
        $invoice = $this->sentInvoice();

        $this->pay($invoice, ['amount' => 0, 'paid_on' => '2026-03-20', 'method' => 'bitcoin'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['amount', 'paid_on', 'method']);

        $this->pay($invoice, ['paid_on' => '2026-02-28'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['paid_on' => 'The payment date can’t be before the invoice date.']);
    }

    public function test_drafts_and_void_invoices_cannot_receive_payments(): void
    {
        $draft = app(SaveDraftInvoice::class)->handle($this->user, [
            'customer_id' => $this->customer->id,
            'issue_date' => '2026-03-01',
            'due_date' => '2026-03-31',
            'items' => [['description' => 'X', 'quantity' => 1, 'unit_price' => 100, 'vat_rate' => 'standard']],
        ]);
        $this->pay($draft)->assertStatus(409);

        $void = $this->sentInvoice();
        $void->markAsVoid();
        $this->pay($void)->assertStatus(409);
    }

    public function test_invoice_with_payments_cannot_be_voided(): void
    {
        $invoice = $this->sentInvoice();
        $this->pay($invoice)->assertCreated();

        $this->actingAs($this->user)
            ->postJson("/api/invoices/{$invoice->id}/void")
            ->assertStatus(409);
    }

    public function test_deleting_a_payment_reopens_a_paid_invoice(): void
    {
        $invoice = $this->sentInvoice();
        $paymentId = $this->pay($invoice, ['amount' => 105000])->json('data.payments.0.id');

        $this->actingAs($this->user)
            ->deleteJson("/api/payments/{$paymentId}")
            ->assertOk()
            ->assertJsonPath('data.status', 'sent')
            ->assertJsonPath('data.amount_paid', 0)
            ->assertJsonPath('data.balance_due', 105000)
            ->assertJsonCount(0, 'data.payments');

        $this->assertNull($invoice->refresh()->paid_at);
    }

    public function test_payments_list_with_filters(): void
    {
        $first = $this->sentInvoice();
        $second = $this->sentInvoice();
        $this->pay($first, ['method' => 'cash', 'paid_on' => '2026-03-02', 'reference' => null]);
        $this->pay($second, ['method' => 'card', 'paid_on' => '2026-03-12', 'reference' => 'AUTH-889']);
        $this->sentInvoice(User::factory()->create()); // someone else's

        $this->actingAs($this->user)->getJson('/api/payments')
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.paid_on', '2026-03-12') // newest first
            ->assertJsonPath('data.0.invoice.number', $second->number)
            ->assertJsonPath('data.0.invoice.customer_name', 'Gulf Foods LLC');

        $this->actingAs($this->user)->getJson('/api/payments?method=cash')->assertJsonCount(1, 'data');
        $this->actingAs($this->user)->getJson('/api/payments?from=2026-03-10&to=2026-03-15')->assertJsonCount(1, 'data');
        $this->actingAs($this->user)->getJson('/api/payments?search=AUTH')->assertJsonCount(1, 'data');
        $this->actingAs($this->user)->getJson('/api/payments?search=gulf')->assertJsonCount(2, 'data');
    }

    public function test_other_users_payments_and_invoices_are_not_found(): void
    {
        $theirInvoice = $this->sentInvoice(User::factory()->create());
        $this->pay($theirInvoice)->assertNotFound();

        $mine = $this->sentInvoice();
        $paymentId = $this->pay($mine)->json('data.payments.0.id');

        $this->actingAs(User::factory()->create())
            ->deleteJson("/api/payments/{$paymentId}")
            ->assertNotFound();
        $this->assertDatabaseCount('payments', 1);
    }
}
