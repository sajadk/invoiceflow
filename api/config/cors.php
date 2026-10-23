<?php

/*
 * In local dev the React app calls the API through Vite's proxy (same origin),
 * so CORS only matters when the SPA is served from a different domain.
 * supports_credentials must stay true for Sanctum's cookie-based SPA auth.
 */
return [

    'paths' => ['api/*', 'sanctum/csrf-cookie'],

    'allowed_methods' => ['*'],

    'allowed_origins' => array_filter(explode(',', (string) env('FRONTEND_URL', 'http://localhost:5173'))),

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 0,

    'supports_credentials' => true,

];
