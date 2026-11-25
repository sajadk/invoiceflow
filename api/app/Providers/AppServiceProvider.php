<?php

namespace App\Providers;

use App\Extraction\ExtractionQuota;
use App\Extraction\InvoiceExtractor;
use App\Extraction\OpenAiCompatibleExtractor;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        // AI capture talks to whichever OpenAI-compatible provider .env points at.
        // Tests use Http::fake(), so the real class (request shape, error handling) is tested too.
        $this->app->bind(InvoiceExtractor::class, fn () => OpenAiCompatibleExtractor::fromConfig());
        $this->app->bind(ExtractionQuota::class, fn () => ExtractionQuota::fromConfig());
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        //
    }
}
