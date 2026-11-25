<?php

namespace Tests\Feature\BillExtractions;

use App\Enums\ExtractionStatus;
use App\Jobs\ExtractBill;
use App\Models\Bill;
use App\Models\BillExtraction;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Sleep;
use Symfony\Component\Process\ExecutableFinder;
use Tests\TestCase;

/**
 * Runs the job against a faked AI provider (Http::fake), so the real
 * OpenAiCompatibleExtractor is exercised: request shape, parsing, error mapping.
 */
class ExtractBillJobTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();

        Carbon::setTestNow('2026-03-15 10:00:00');
        config([
            'invoiceflow.extraction.base_url' => 'https://ai.example.test/v1',
            'invoiceflow.extraction.api_key' => 'test-key',
            'invoiceflow.extraction.model' => 'test-vision-model',
            'invoiceflow.extraction.reasoning_effort' => 'low',
        ]);
        Sleep::fake(); // no real back-off between retries
        $this->user = User::factory()->create();
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    /** What a model returns for the office-supplies fixture. */
    private function answer(array $overrides = []): array
    {
        return [
            'is_invoice' => true,
            'supplier_name' => 'Example Office Supplies LLC',
            'supplier_trn' => '100000000012345',
            'invoice_number' => 'EOS-2026-0412',
            'issue_date' => '2026-03-12',
            'due_date' => '2026-04-11',
            'currency' => 'AED',
            'lines' => [
                ['description' => 'A4 copier paper', 'quantity' => 10, 'unit_price' => 22.5, 'vat_percent' => 5],
                ['description' => 'Toner cartridge', 'quantity' => 2, 'unit_price' => 345, 'vat_percent' => 5],
                ['description' => 'Desk organiser', 'quantity' => 3, 'unit_price' => 48.75, 'vat_percent' => 5],
            ],
            'subtotal' => 1061.25,
            'vat_total' => 53.06,
            'total' => 1114.31,
            ...$overrides,
        ];
    }

    private function fakeProvider(array|string $content, int $status = 200): void
    {
        Http::fake(['ai.example.test/*' => Http::response($status === 200 ? [
            'model' => 'test-vision-model-001',
            'choices' => [['index' => 0, 'message' => ['role' => 'assistant', 'content' => is_array($content) ? json_encode($content) : $content]]],
        ] : ['error' => ['message' => 'provider error']], $status)]);
    }

    private function upload(string $contents, string $mime = 'image/png'): BillExtraction
    {
        $extraction = new BillExtraction([
            'original_filename' => 'invoice',
            'mime' => $mime,
            'size' => strlen($contents),
            'file_contents' => base64_encode($contents),
        ]);
        $extraction->user()->associate($this->user)->save();

        return $extraction;
    }

    private function png(): BillExtraction
    {
        return $this->upload(base64_decode(BillExtractionApiTest::PNG));
    }

    public function test_it_reads_the_invoice_into_a_prefilled_bill(): void
    {
        $this->fakeProvider("```json\n".json_encode($this->answer())."\n```");
        $extraction = $this->png();

        ExtractBill::dispatchSync($extraction->id);

        $extraction->refresh();
        $this->assertSame(ExtractionStatus::Completed, $extraction->status);
        $this->assertNull($extraction->file_contents, 'the upload is deleted once read');
        $this->assertSame('test-vision-model-001', $extraction->model);
        $this->assertSame([], $extraction->warnings);
        $this->assertSame([
            'supplier_name' => 'Example Office Supplies LLC',
            'supplier_trn' => '100000000012345',
            'supplier_invoice_number' => 'EOS-2026-0412',
            'issue_date' => '2026-03-12',
            'due_date' => '2026-04-11',
            'currency' => 'AED',
        ], array_intersect_key($extraction->result, array_flip(['supplier_name', 'supplier_trn', 'supplier_invoice_number', 'issue_date', 'due_date', 'currency'])));
        $this->assertSame(['description' => 'A4 copier paper', 'quantity' => '10.000', 'unit_price' => 2250, 'vat_rate' => 'standard'], $extraction->result['items'][0]);
        $this->assertSame(['subtotal' => 106125, 'vat_total' => 5306, 'total' => 111431], $extraction->result['totals']);
        $this->assertNull($extraction->result['duplicate_bill_id']);

        Http::assertSent(function (Request $request) {
            $content = $request['messages'][1]['content'];

            return $request->url() === 'https://ai.example.test/v1/chat/completions'
                && $request->hasHeader('Authorization', 'Bearer test-key')
                && $request['model'] === 'test-vision-model'
                && $request['temperature'] === 0
                && $request['response_format'] === ['type' => 'json_object']
                && $request['reasoning_effort'] === 'low'
                && $request['messages'][0]['role'] === 'system'
                && $content[1]['image_url']['url'] === 'data:image/png;base64,'.BillExtractionApiTest::PNG;
        });
    }

    public function test_doubtful_values_become_warnings_on_their_fields(): void
    {
        $this->fakeProvider($this->answer(['supplier_trn' => null, 'total' => 1200]));
        $extraction = $this->png();

        ExtractBill::dispatchSync($extraction->id);

        $fields = array_column($extraction->refresh()->warnings, 'field');
        $this->assertSame(ExtractionStatus::Completed, $extraction->status);
        $this->assertContains('supplier_trn', $fields); // VAT charged without a TRN
        $this->assertContains('totals', $fields);       // lines don't add up to the printed total
    }

    public function test_it_warns_about_an_invoice_already_recorded(): void
    {
        $bill = new Bill([
            'supplier_name' => 'Example Office Supplies LLC',
            'supplier_invoice_number' => 'EOS-2026-0412',
            'issue_date' => '2026-03-12',
        ]);
        $bill->user()->associate($this->user)->save();

        $this->fakeProvider($this->answer());
        $extraction = $this->png();

        ExtractBill::dispatchSync($extraction->id);

        $extraction->refresh();
        $this->assertSame($bill->id, $extraction->result['duplicate_bill_id']);
        $this->assertSame('supplier_invoice_number', $extraction->warnings[0]['field']);
    }

    public function test_something_that_is_not_an_invoice_fails_with_a_clear_message(): void
    {
        $this->fakeProvider(['is_invoice' => false]);
        $extraction = $this->png();

        ExtractBill::dispatchSync($extraction->id);

        $extraction->refresh();
        $this->assertSame(ExtractionStatus::Failed, $extraction->status);
        $this->assertStringContainsString('doesn’t look like an invoice', $extraction->error);
        $this->assertNull($extraction->file_contents);
    }

    public function test_an_unreadable_answer_fails(): void
    {
        $this->fakeProvider('Sorry, I can’t help with that.');
        $extraction = $this->png();

        ExtractBill::dispatchSync($extraction->id);

        $this->assertStringContainsString('couldn’t be read', $extraction->refresh()->error);
    }

    public function test_provider_errors_are_retried_once_then_shown_safely(): void
    {
        $this->fakeProvider([], 429);
        $extraction = $this->png();

        ExtractBill::dispatchSync($extraction->id);

        $extraction->refresh();
        $this->assertSame(ExtractionStatus::Failed, $extraction->status);
        $this->assertStringContainsString('free quota', $extraction->error);
        $this->assertStringNotContainsString('provider error', $extraction->error);
        Http::assertSentCount(2);
    }

    public function test_a_rejected_api_key_is_not_retried(): void
    {
        $this->fakeProvider([], 401);
        $extraction = $this->png();

        ExtractBill::dispatchSync($extraction->id);

        $this->assertStringContainsString('credentials', $extraction->refresh()->error);
        Http::assertSentCount(1);
    }

    public function test_an_extraction_is_only_processed_once(): void
    {
        $this->fakeProvider($this->answer());
        $extraction = $this->png();
        $extraction->forceFill(['status' => ExtractionStatus::Completed])->save();

        ExtractBill::dispatchSync($extraction->id);

        Http::assertNothingSent();
    }

    public function test_pdfs_are_rendered_to_images_and_long_ones_are_cut_short(): void
    {
        if (! (new ExecutableFinder)->find('pdftoppm')) {
            $this->markTestSkipped('poppler-utils (pdftoppm) is not installed; it is in the Docker images.');
        }

        config(['invoiceflow.extraction.max_pages' => 1]);
        $this->fakeProvider($this->answer());
        $extraction = $this->upload(file_get_contents(base_path('tests/Fixtures/extraction/software-two-pages.pdf')), 'application/pdf');

        ExtractBill::dispatchSync($extraction->id);

        $extraction->refresh();
        $this->assertSame(ExtractionStatus::Completed, $extraction->status);
        $this->assertSame('document', $extraction->warnings[0]['field']);
        $this->assertStringContainsString('first 1 of 2 pages', $extraction->warnings[0]['message']);

        Http::assertSent(function (Request $request) {
            $images = array_slice($request['messages'][1]['content'], 1);

            return count($images) === 1 && str_starts_with($images[0]['image_url']['url'], 'data:image/png;base64,iVBORw0KGgo');
        });
    }

    public function test_a_broken_pdf_fails_without_calling_the_ai(): void
    {
        if (! (new ExecutableFinder)->find('pdftoppm')) {
            $this->markTestSkipped('poppler-utils (pdftoppm) is not installed; it is in the Docker images.');
        }

        $this->fakeProvider($this->answer());
        $extraction = $this->upload('%PDF-1.4 this is not really a pdf', 'application/pdf');

        ExtractBill::dispatchSync($extraction->id);

        $this->assertStringContainsString('PDF couldn’t be opened', $extraction->refresh()->error);
        Http::assertNothingSent();
    }
}
