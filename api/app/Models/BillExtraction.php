<?php

namespace App\Models;

use App\Enums\ExtractionStatus;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * An uploaded supplier invoice and what the AI read from it.
 *
 * @property string $id
 * @property int $user_id
 * @property ExtractionStatus $status
 * @property string $original_filename
 * @property string $mime
 * @property int $size
 * @property string|null $file_contents base64, cleared once processed
 * @property array<string, mixed>|null $result
 * @property list<array{field: string, message: string}>|null $warnings
 * @property string|null $error
 * @property string|null $model
 * @property int|null $duration_ms
 * @property Carbon|null $completed_at
 * @property Carbon $created_at
 */
class BillExtraction extends Model
{
    use HasUlids;

    /** A job that hasn't finished by then has been lost (worker down or killed). */
    public const STALE_AFTER_MINUTES = 5;

    protected $fillable = ['original_filename', 'mime', 'size', 'file_contents'];

    protected $hidden = ['file_contents'];

    protected $attributes = [
        'status' => 'pending',
    ];

    protected function casts(): array
    {
        return [
            'status' => ExtractionStatus::class,
            'size' => 'integer',
            'result' => 'array',
            'warnings' => 'array',
            'duration_ms' => 'integer',
            'completed_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * @param  array<string, mixed>  $result
     * @param  list<array{field: string, message: string}>  $warnings
     */
    public function markCompleted(array $result, array $warnings, string $model, int $durationMs): void
    {
        $this->forceFill([
            'status' => ExtractionStatus::Completed,
            'result' => $result,
            'warnings' => $warnings,
            'error' => null,
            'model' => $model,
            'duration_ms' => $durationMs,
            'file_contents' => null,
            'completed_at' => now(),
        ])->save();
    }

    public function markFailed(string $message, ?int $durationMs = null): void
    {
        $this->forceFill([
            'status' => ExtractionStatus::Failed,
            'error' => $message,
            'duration_ms' => $durationMs,
            'file_contents' => null,
            'completed_at' => now(),
        ])->save();
    }

    /** Called when polled: a job that never finished shouldn't keep the browser waiting forever. */
    public function failIfStale(): void
    {
        if (! $this->status->isFinished() && $this->created_at->lt(now()->subMinutes(self::STALE_AFTER_MINUTES))) {
            $this->markFailed('Reading the invoice took too long. Please try again, or enter the bill by hand.');
        }
    }
}
