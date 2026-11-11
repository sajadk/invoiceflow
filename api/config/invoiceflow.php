<?php

return [

    /*
     * Shared secret CloudFront adds to every request it forwards to the API
     * (custom origin header "X-Origin-Verify"). When set, requests without it
     * are refused, so nobody can bypass CloudFront and call the server directly.
     * Leave empty locally and in tests.
     */
    'origin_secret' => env('ORIGIN_SECRET'),

];
