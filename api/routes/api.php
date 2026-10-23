<?php

use App\Http\Controllers\Api\HealthController;
use Illuminate\Support\Facades\Route;

// Public
Route::get('/health', HealthController::class)->name('health');

// Authenticated routes (auth:sanctum) arrive in milestone 2.
