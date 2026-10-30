<?php

namespace Database\Seeders;

use App\Actions\Invoices\SaveDraftInvoice;
use App\Actions\Invoices\SendInvoice;
use App\Models\Customer;
use App\Models\Invoice;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;

class DatabaseSeeder extends Seeder
{
    /** [description, unit price in fils, VAT rate, typical quantity] */
    private const CATALOGUE = [
        ['Website maintenance (monthly retainer)', 150000, 'standard', 1],
        ['Brand identity & logo design', 450000, 'standard', 1],
        ['Consulting (hourly)', 45000, 'standard', 6.5],
        ['Cloud hosting (annual plan)', 120000, 'standard', 1],
        ['On-site training workshop', 300000, 'standard', 1],
        ['Export shipment handling (outside GCC)', 85000, 'zero', 2],
        ['Mobile app UI design (per screen)', 60000, 'standard', 8],
        ['Residential unit management fee', 200000, 'exempt', 1],
        ['SEO audit', 275000, 'standard', 1],
        ['Copywriting (per 1,000 words)', 35000, 'standard', 3],
    ];

    /**
     * Demo account shown on the login page so reviewers can try the app without registering.
     * Safe to re-run: only adds sample data the first time.
     */
    public function run(): void
    {
        $demo = User::updateOrCreate(
            ['email' => 'demo@invoiceflow.test'],
            ['name' => 'Demo User', 'password' => 'password'],
        );

        if (! Customer::whereBelongsTo($demo)->exists()) {
            Customer::factory()->count(32)->for($demo)->create();
        }

        if (! Invoice::whereBelongsTo($demo)->exists()) {
            $this->seedInvoices($demo);
        }
    }

    private function seedInvoices(User $demo): void
    {
        $customers = Customer::whereBelongsTo($demo)->get();
        $saveDraft = app(SaveDraftInvoice::class);
        $send = app(SendInvoice::class);

        // Oldest first, so invoice numbers increase with the issue date.
        $issueDates = collect(range(1, 28))
            ->map(fn () => Carbon::today()->subDays(fake()->numberBetween(0, 150)))
            ->sort()
            ->values();

        foreach ($issueDates as $index => $issueDate) {
            $invoice = $saveDraft->handle($demo, [
                'customer_id' => $customers->random()->id,
                'issue_date' => $issueDate->toDateString(),
                'due_date' => $issueDate->copy()->addDays(fake()->randomElement([7, 14, 30]))->toDateString(),
                'notes' => fake()->boolean(40) ? 'Payment by bank transfer to Emirates NBD, IBAN on request. Thank you for your business.' : null,
                'items' => collect(fake()->randomElements(self::CATALOGUE, fake()->numberBetween(1, 4)))
                    ->map(fn (array $line) => [
                        'description' => $line[0],
                        'unit_price' => $line[1],
                        'vat_rate' => $line[2],
                        'quantity' => $line[3],
                    ])->all(),
            ]);

            $isRecent = $index >= $issueDates->count() - 3;
            if ($isRecent) {
                continue; // the newest few stay as drafts
            }

            $send->handle($invoice);

            $ageInDays = (int) $issueDate->diffInDays(Carbon::today());
            match (true) {
                $index === 5 => $invoice->markAsVoid(),
                $ageInDays > 40 && fake()->boolean(80) => $invoice->markAsPaid(),
                $ageInDays > 15 && fake()->boolean(40) => $invoice->markAsPaid(),
                default => null, // stays sent: some will be overdue
            };
        }
    }
}
