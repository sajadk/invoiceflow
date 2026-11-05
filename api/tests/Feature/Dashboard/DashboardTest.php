<?php

namespace Tests\Feature\Dashboard;

use App\Actions\Invoices\SaveDraftInvoice;
use App\Actions\Invoices\SendInvoice;
use App\Actions\Payments\RecordPayment;
use App\Models\Customer;
use App\Models\Invoice;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

class DashboardTest extends TestCase
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

    /** Every invoice here is AED 1,050.00 = 105000 fils (1,000 + 5% VAT). */
    private function invoice(Customer $customer, string $issue, string $due, bool $send = true): Invoice
    {
        $invoice = app(SaveDraftInvoice::class)->handle($this->user, [
            'customer_id' => $customer->id,
            'issue_date' => $issue,
            'due_date' => $due,
            'items' => [['description' => 'Service', 'quantity' => 1, 'unit_price' => 100000, 'vat_rate' => 'standard']],
        ]);

        return $send ? app(SendInvoice::class)->handle($invoice) : $invoice;
    }

    private function pay(Invoice $invoice, int $amount, string $on): void
    {
        app(RecordPayment::class)->handle($invoice, ['amount' => $amount, 'paid_on' => $on, 'method' => 'bank_transfer']);
    }

    public function test_dashboard_summary(): void
    {
        $alNoor = Customer::factory()->for($this->user)->create(['name' => 'Al Noor']);
        $gulf = Customer::factory()->for($this->user)->create(['name' => 'Gulf Foods']);

        // 54 days overdue, AED 50 paid in February → balance 100000
        $overdue = $this->invoice($alNoor, '2026-01-10', '2026-01-20');
        $this->pay($overdue, 5000, '2026-02-01');

        // Not yet due, unpaid → balance 105000
        $this->invoice($gulf, '2026-03-01', '2026-03-31');

        // Paid in full this month → not outstanding
        $paid = $this->invoice($alNoor, '2026-03-05', '2026-03-10');
        $this->pay($paid, 105000, '2026-03-12');

        // Never counted: a draft, a void invoice, and another user's invoice
        $this->invoice($gulf, '2026-03-02', '2026-03-30', send: false);
        $this->invoice($gulf, '2026-02-01', '2026-02-15')->markAsVoid();
        $stranger = User::factory()->create();
        app(SendInvoice::class)->handle(app(SaveDraftInvoice::class)->handle($stranger, [
            'customer_id' => Customer::factory()->for($stranger)->create()->id,
            'issue_date' => '2026-03-01',
            'due_date' => '2026-03-02',
            'items' => [['description' => 'X', 'quantity' => 1, 'unit_price' => 999900, 'vat_rate' => 'standard']],
        ]));

        $response = $this->actingAs($this->user)->getJson('/api/dashboard')->assertOk();

        $response
            ->assertJsonPath('data.as_of', '2026-03-15')
            ->assertJsonPath('data.outstanding', ['count' => 2, 'amount' => 205000])
            ->assertJsonPath('data.overdue', ['count' => 1, 'amount' => 100000])
            ->assertJsonPath('data.collected.this_month', 105000)
            ->assertJsonPath('data.collected.last_month', 5000)
            ->assertJsonPath('data.vat.period', 'Q1 2026')
            ->assertJsonPath('data.vat.amount', 15000) // three issued invoices × AED 50 VAT
            ->assertJsonCount(12, 'data.monthly')
            ->assertJsonPath('data.monthly.11', ['month' => '2026-03', 'invoiced' => 210000, 'collected' => 105000])
            ->assertJsonPath('data.monthly.10', ['month' => '2026-02', 'invoiced' => 0, 'collected' => 5000])
            ->assertJsonPath('data.monthly.9', ['month' => '2026-01', 'invoiced' => 105000, 'collected' => 0])
            ->assertJsonPath('data.monthly.0.month', '2025-04')
            ->assertJsonPath('data.top_debtors.0.name', 'Gulf Foods')
            ->assertJsonPath('data.top_debtors.0.amount', 105000)
            ->assertJsonPath('data.top_debtors.1.name', 'Al Noor')
            ->assertJsonPath('data.top_debtors.1.amount', 100000)
            ->assertJsonCount(2, 'data.recent_payments')
            ->assertJsonPath('data.recent_payments.0.paid_on', '2026-03-12');

        $aging = collect($response->json('data.aging'))->keyBy('bucket');
        $this->assertSame(['current', '1_30', '31_60', '61_90', '90_plus'], $aging->keys()->all());
        $this->assertSame(['count' => 1, 'amount' => 105000], [
            'count' => $aging['current']['count'], 'amount' => $aging['current']['amount'],
        ]);
        $this->assertSame(100000, $aging['31_60']['amount']);
        $this->assertSame(0, $aging['90_plus']['amount']);
    }

    public function test_empty_dashboard(): void
    {
        $this->actingAs($this->user)
            ->getJson('/api/dashboard')
            ->assertOk()
            ->assertJsonPath('data.outstanding', ['count' => 0, 'amount' => 0])
            ->assertJsonPath('data.top_debtors', [])
            ->assertJsonPath('data.recent_payments', []);
    }

    public function test_guests_cannot_see_the_dashboard(): void
    {
        $this->getJson('/api/dashboard')->assertUnauthorized();
    }
}
