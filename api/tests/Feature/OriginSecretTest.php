<?php

namespace Tests\Feature;

use App\Http\Middleware\VerifyOriginSecret;
use Tests\TestCase;

class OriginSecretTest extends TestCase
{
    public function test_requests_are_allowed_when_no_secret_is_configured(): void
    {
        config(['invoiceflow.origin_secret' => null]);

        $this->getJson('/api/health')->assertOk();
    }

    public function test_requests_without_the_secret_are_refused(): void
    {
        config(['invoiceflow.origin_secret' => 's3cret-from-cloudfront']);

        $this->getJson('/api/health')->assertForbidden();
        $this->getJson('/api/health', [VerifyOriginSecret::HEADER => 'wrong'])->assertForbidden();
        $this->postJson('/api/login', [])->assertForbidden(); // checked before anything else runs
    }

    public function test_requests_with_the_secret_pass(): void
    {
        config(['invoiceflow.origin_secret' => 's3cret-from-cloudfront']);

        $this->getJson('/api/health', [VerifyOriginSecret::HEADER => 's3cret-from-cloudfront'])->assertOk();
    }
}
