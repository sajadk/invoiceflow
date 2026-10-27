<?php

namespace Tests\Concerns;

/**
 * Sanctum only starts a session for requests that come from a "stateful" domain,
 * which it detects from the Origin/Referer headers. The browser sends these
 * automatically; in tests we add them so login/logout run through the real session flow.
 */
trait MakesSpaRequests
{
    protected function fromSpa(): static
    {
        return $this->withHeaders([
            'Origin' => 'http://localhost:5173',
            'Referer' => 'http://localhost:5173/',
        ]);
    }
}
