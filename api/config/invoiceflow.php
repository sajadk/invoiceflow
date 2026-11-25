<?php

return [

    /*
     * Shared secret CloudFront adds to every request it forwards to the API
     * (custom origin header "X-Origin-Verify"). When set, requests without it
     * are refused, so nobody can bypass CloudFront and call the server directly.
     * Leave empty locally and in tests.
     */
    'origin_secret' => env('ORIGIN_SECRET'),

    /*
     * AI invoice capture: a supplier invoice (PDF or photo) is read by a vision
     * model and turned into a pre-filled bill for the user to review.
     *
     * Any OpenAI-compatible chat completions API works. The default is Google's
     * Gemini endpoint (free tier). For OpenAI itself, use https://api.openai.com/v1
     * and a model such as gpt-4o-mini; for a local Ollama, http://host.docker.internal:11434/v1.
     */
    'extraction' => [
        'base_url' => rtrim((string) env('AI_BASE_URL', 'https://generativelanguage.googleapis.com/v1beta/openai'), '/'),
        'api_key' => env('AI_API_KEY'),
        'model' => env('AI_MODEL', 'gemini-2.5-flash'),

        // Ask for a JSON response (response_format: json_object). Turn off for providers that reject it;
        // the reply is parsed leniently either way.
        'json_mode' => (bool) env('AI_JSON_MODE', true),

        // Sent as reasoning_effort when set ("low" keeps Gemini 2.5 fast). Leave empty for models without it.
        'reasoning_effort' => env('AI_REASONING_EFFORT') ?: null,

        'timeout' => (int) env('AI_TIMEOUT', 60), // seconds per HTTP attempt

        // Free tiers have small daily quotas, and this is a public demo.
        'daily_limit_per_user' => (int) env('AI_DAILY_LIMIT_PER_USER', 10),
        'daily_limit_global' => (int) env('AI_DAILY_LIMIT_GLOBAL', 100),

        'max_file_kb' => 5 * 1024,
        'max_pages' => 3, // PDF pages sent to the model; the rest are skipped with a warning
    ],

];
