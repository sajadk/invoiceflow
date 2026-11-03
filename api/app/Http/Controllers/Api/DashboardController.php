<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Queries\DashboardSummary;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        return response()->json([
            'data' => (new DashboardSummary($request->user()))->toArray($request),
        ]);
    }
}
