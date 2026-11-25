<?php

namespace App\Extraction;

use App\Models\BillExtraction;
use App\Models\User;
use Illuminate\Support\Carbon;
use Symfony\Component\HttpKernel\Exception\TooManyRequestsHttpException;

/**
 * Daily limits for AI capture: per user, and for the whole demo, so one visitor
 * can't use up the free tier for everyone. Counted from the extraction rows
 * (every upload counts, including failed ones, since each one is an AI call).
 * Days run on the app timezone (Asia/Dubai).
 *
 * Count-then-insert can overshoot by a request or two under concurrency;
 * for a usage cap that's fine, and the per-minute throttle on the route
 * limits bursts anyway.
 */
class ExtractionQuota
{
    public function __construct(
        private readonly int $perUser,
        private readonly int $global,
    ) {}

    public static function fromConfig(): self
    {
        return new self(
            (int) config('invoiceflow.extraction.daily_limit_per_user'),
            (int) config('invoiceflow.extraction.daily_limit_global'),
        );
    }

    /** @return array{limit: int, used: int, remaining: int, resets_at: string} */
    public function usage(User $user): array
    {
        $used = BillExtraction::query()->whereBelongsTo($user)->where('created_at', '>=', $this->startOfDay())->count();
        $remaining = max(0, min($this->perUser - $used, $this->globalRemaining()));

        return [
            'limit' => $this->perUser,
            'used' => $used,
            'remaining' => $remaining,
            'resets_at' => $this->resetsAt()->toIso8601String(),
        ];
    }

    /** @throws TooManyRequestsHttpException 429 with Retry-After until midnight */
    public function ensureAvailable(User $user): void
    {
        $retryAfter = (int) ceil(now()->diffInSeconds($this->resetsAt(), absolute: true));

        if ($this->globalRemaining() <= 0) {
            throw new TooManyRequestsHttpException($retryAfter, 'The demo’s AI capture limit for today has been reached. Please try again tomorrow, or enter the bill by hand.');
        }

        if ($this->usage($user)['used'] >= $this->perUser) {
            throw new TooManyRequestsHttpException($retryAfter, "You’ve used all {$this->perUser} invoice uploads for today. You can still enter bills by hand.");
        }
    }

    private function globalRemaining(): int
    {
        return $this->global - BillExtraction::query()->where('created_at', '>=', $this->startOfDay())->count();
    }

    private function startOfDay(): Carbon
    {
        return now()->startOfDay();
    }

    private function resetsAt(): Carbon
    {
        return now()->addDay()->startOfDay();
    }
}
