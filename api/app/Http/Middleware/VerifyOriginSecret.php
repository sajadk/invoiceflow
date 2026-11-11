<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Defence in depth behind CloudFront: the security group already only lets
 * CloudFront's IP ranges reach the server, and this proves the request came
 * through *our* distribution (any CloudFront customer shares those ranges).
 */
class VerifyOriginSecret
{
    public const HEADER = 'X-Origin-Verify';

    public function handle(Request $request, Closure $next): Response
    {
        $secret = (string) config('invoiceflow.origin_secret');

        // hash_equals: constant-time comparison, so the secret can't be guessed byte by byte.
        if ($secret !== '' && ! hash_equals($secret, (string) $request->header(self::HEADER))) {
            abort(403, 'Direct access is not allowed.');
        }

        return $next($request);
    }
}
