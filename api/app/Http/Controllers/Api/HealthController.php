<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Throwable;

class HealthController extends Controller
{
    /**
     * Liveness + dependency check used by the React app, Docker and (later) the AWS load balancer.
     */
    public function __invoke(): JsonResponse
    {
        $databaseOk = $this->databaseIsReachable();

        return response()->json([
            'status' => $databaseOk ? 'ok' : 'degraded',
            'app' => config('app.name'),
            'checks' => [
                'database' => $databaseOk ? 'ok' : 'unreachable',
            ],
            'timestamp' => now()->toIso8601String(),
        ], $databaseOk ? 200 : 503);
    }

    private function databaseIsReachable(): bool
    {
        try {
            DB::connection()->getPdo();

            return true;
        } catch (Throwable) {
            return false;
        }
    }
}
