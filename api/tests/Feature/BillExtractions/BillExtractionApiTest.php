<?php

namespace Tests\Feature\BillExtractions;

use App\Enums\ExtractionStatus;
use App\Jobs\ExtractBill;
use App\Models\BillExtraction;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

class BillExtractionApiTest extends TestCase
{
    use RefreshDatabase;

    /** A real 1×1 PNG: the upload rules sniff the type from the contents. */
    public const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();

        Carbon::setTestNow('2026-03-15 10:00:00');
        config([
            'invoiceflow.extraction.api_key' => 'test-key',
            'invoiceflow.extraction.daily_limit_per_user' => 3,
            'invoiceflow.extraction.daily_limit_global' => 5,
        ]);
        Queue::fake();
        $this->user = User::factory()->create();
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    public static function png(string $name = 'invoice.png'): UploadedFile
    {
        return UploadedFile::fake()->createWithContent($name, base64_decode(self::PNG));
    }

    private function existingExtraction(User $user, array $attributes = []): BillExtraction
    {
        $extraction = new BillExtraction(['original_filename' => 'x.png', 'mime' => 'image/png', 'size' => 10]);
        $extraction->user()->associate($user);
        $extraction->forceFill($attributes)->save();

        return $extraction;
    }

    public function test_uploading_queues_the_document_and_returns_202(): void
    {
        $response = $this->actingAs($this->user)
            ->post('/api/bill-extractions', ['file' => self::png('supplier invoice.png')], ['Accept' => 'application/json'])
            ->assertAccepted()
            ->assertJsonPath('data.status', 'pending')
            ->assertJsonPath('data.original_filename', 'supplier invoice.png')
            ->assertJsonPath('data.mime', 'image/png')
            ->assertJsonMissingPath('data.file_contents');

        $extraction = BillExtraction::query()->findOrFail($response->json('data.id'));
        $this->assertSame(self::PNG, $extraction->file_contents);
        $this->assertTrue($extraction->user->is($this->user));

        Queue::assertPushed(ExtractBill::class, fn (ExtractBill $job) => $job->extractionId === $extraction->id);
    }

    public function test_only_pdfs_and_images_up_to_5_mb_are_accepted(): void
    {
        $this->actingAs($this->user);

        $this->postJson('/api/bill-extractions', [])->assertUnprocessable()->assertJsonValidationErrors('file');

        $this->postJson('/api/bill-extractions', ['file' => UploadedFile::fake()->createWithContent('notes.txt', 'just text')])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['file' => 'Upload a PDF, JPG, PNG or WebP file.']);

        $this->postJson('/api/bill-extractions', ['file' => UploadedFile::fake()->create('scan.pdf', 6 * 1024, 'application/pdf')])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('file');

        Queue::assertNothingPushed();
        $this->assertDatabaseCount('bill_extractions', 0);
    }

    public function test_it_is_unavailable_without_an_api_key(): void
    {
        config(['invoiceflow.extraction.api_key' => null]);

        $this->actingAs($this->user)->getJson('/api/bill-extractions/usage')->assertOk()->assertJsonPath('data.enabled', false);
        $this->postJson('/api/bill-extractions', ['file' => self::png()])->assertStatus(503);

        Queue::assertNothingPushed();
    }

    public function test_usage_counts_todays_uploads(): void
    {
        $this->existingExtraction($this->user);
        $this->existingExtraction($this->user, ['created_at' => '2026-03-14 23:00:00']); // yesterday (Dubai time)
        $this->existingExtraction(User::factory()->create());

        $this->actingAs($this->user)->getJson('/api/bill-extractions/usage')
            ->assertOk()
            ->assertJsonPath('data.enabled', true)
            ->assertJsonPath('data.limit', 3)
            ->assertJsonPath('data.used', 1)
            ->assertJsonPath('data.remaining', 2)
            ->assertJsonPath('data.max_pages', 3);
    }

    public function test_the_daily_limit_per_user(): void
    {
        foreach (range(1, 3) as $ignored) {
            $this->existingExtraction($this->user);
        }

        $this->actingAs($this->user)->postJson('/api/bill-extractions', ['file' => self::png()])
            ->assertTooManyRequests()
            ->assertHeader('Retry-After')
            ->assertJsonPath('message', 'You’ve used all 3 invoice uploads for today. You can still enter bills by hand.');

        // Someone else still can.
        $this->actingAs(User::factory()->create())->postJson('/api/bill-extractions', ['file' => self::png()])->assertAccepted();
    }

    public function test_the_daily_limit_for_the_whole_demo(): void
    {
        foreach (range(1, 5) as $ignored) {
            $this->existingExtraction(User::factory()->create());
        }

        $this->actingAs($this->user)->getJson('/api/bill-extractions/usage')->assertJsonPath('data.remaining', 0);
        $this->postJson('/api/bill-extractions', ['file' => self::png()])
            ->assertTooManyRequests()
            ->assertJsonPath('message', fn (string $message) => str_contains($message, 'limit for today'));
    }

    public function test_polling_returns_the_result(): void
    {
        $extraction = $this->existingExtraction($this->user, [
            'status' => ExtractionStatus::Completed,
            'result' => ['supplier_name' => 'Example Office Supplies LLC'],
            'warnings' => [['field' => 'supplier_trn', 'message' => 'Check it.']],
            'model' => 'gemini-2.5-flash',
        ]);

        $this->actingAs($this->user)->getJson("/api/bill-extractions/{$extraction->id}")
            ->assertOk()
            ->assertJsonPath('data.status', 'completed')
            ->assertJsonPath('data.result.supplier_name', 'Example Office Supplies LLC')
            ->assertJsonPath('data.warnings.0.field', 'supplier_trn');
    }

    public function test_other_users_extractions_are_not_found(): void
    {
        $theirs = $this->existingExtraction(User::factory()->create());

        $this->actingAs($this->user)->getJson("/api/bill-extractions/{$theirs->id}")->assertNotFound();
        $this->getJson('/api/bill-extractions/not-a-ulid')->assertNotFound();
    }

    public function test_an_extraction_that_never_finishes_is_failed_when_polled(): void
    {
        $extraction = $this->existingExtraction($this->user, ['created_at' => now()->subMinutes(6), 'file_contents' => 'abc']);

        $this->actingAs($this->user)->getJson("/api/bill-extractions/{$extraction->id}")
            ->assertOk()
            ->assertJsonPath('data.status', 'failed')
            ->assertJsonPath('data.error', fn (string $error) => str_contains($error, 'took too long'));

        $this->assertNull($extraction->refresh()->file_contents);
    }

    public function test_guests_cannot_upload(): void
    {
        $this->postJson('/api/bill-extractions', ['file' => self::png()])->assertUnauthorized();
        $this->getJson('/api/bill-extractions/usage')->assertUnauthorized();
    }
}
