<?php

namespace App\Extraction;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\RequestException;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Calls any OpenAI-compatible chat completions API with the invoice images
 * (Gemini by default; OpenAI, Groq, OpenRouter or a local Ollama work the same way).
 * Only Laravel's HTTP client: no vendor SDK, so switching providers is a .env change.
 */
class OpenAiCompatibleExtractor implements InvoiceExtractor
{
    /** Statuses worth one more try: rate limiting and temporary overload are common on free tiers. */
    private const RETRYABLE = [429, 500, 502, 503, 504];

    public function __construct(
        private readonly string $baseUrl,
        private readonly string $apiKey,
        private readonly string $model,
        private readonly bool $jsonMode = true,
        private readonly ?string $reasoningEffort = null,
        private readonly int $timeout = 60,
    ) {}

    public static function fromConfig(): self
    {
        $config = config('invoiceflow.extraction');

        return new self(
            baseUrl: $config['base_url'],
            apiKey: (string) $config['api_key'],
            model: $config['model'],
            jsonMode: $config['json_mode'],
            reasoningEffort: $config['reasoning_effort'],
            timeout: $config['timeout'],
        );
    }

    public function extract(array $pages): array
    {
        $content = [['type' => 'text', 'text' => ExtractionPrompt::user(count($pages))]];
        foreach ($pages as $page) {
            $content[] = ['type' => 'image_url', 'image_url' => ['url' => $page->dataUri()]];
        }

        $payload = array_filter([
            'model' => $this->model,
            'temperature' => 0,
            'messages' => [
                ['role' => 'system', 'content' => ExtractionPrompt::SYSTEM],
                ['role' => 'user', 'content' => $content],
            ],
            'response_format' => $this->jsonMode ? ['type' => 'json_object'] : null,
            'reasoning_effort' => $this->reasoningEffort,
        ], fn ($value) => $value !== null);

        try {
            $response = Http::withToken($this->apiKey)
                ->acceptJson()
                ->timeout($this->timeout)
                ->retry(2, 2000, fn (Throwable $exception) => $exception instanceof ConnectionException
                    || ($exception instanceof RequestException && in_array($exception->response->status(), self::RETRYABLE, true)), throw: false)
                ->post("{$this->baseUrl}/chat/completions", $payload);
        } catch (ConnectionException) {
            throw ExtractionException::serviceUnavailable();
        }

        if ($response->failed()) {
            $this->logFailure($response);

            throw match (true) {
                in_array($response->status(), [401, 403], true) => ExtractionException::serviceMisconfigured(),
                $response->status() === 429 => ExtractionException::quotaExhausted(),
                default => ExtractionException::serviceUnavailable(),
            };
        }

        $data = self::parseJson((string) $response->json('choices.0.message.content'));
        if ($data === null) {
            throw ExtractionException::unreadableAnswer();
        }

        return ['data' => $data, 'model' => (string) ($response->json('model') ?: $this->model)];
    }

    /**
     * Models sometimes wrap JSON in ```json fences or add a sentence around it,
     * even in JSON mode. Take the outermost {...} and decode that.
     *
     * @return array<string, mixed>|null
     */
    public static function parseJson(string $content): ?array
    {
        $start = strpos($content, '{');
        $end = strrpos($content, '}');
        if ($start === false || $end === false || $end < $start) {
            return null;
        }

        $decoded = json_decode(substr($content, $start, $end - $start + 1), true);

        return is_array($decoded) && ! array_is_list($decoded) ? $decoded : null;
    }

    /** The provider's error body helps the developer; it's logged, never shown to users. */
    private function logFailure(Response $response): void
    {
        Log::warning('Invoice extraction request failed', [
            'status' => $response->status(),
            'model' => $this->model,
            'body' => mb_substr($response->body(), 0, 1000),
        ]);
    }
}
