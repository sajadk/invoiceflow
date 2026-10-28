<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CustomerController;
use App\Http\Controllers\Api\HealthController;
use Illuminate\Support\Facades\Route;

// Public
Route::get('/health', HealthController::class)->name('health');

Route::post('/register', [AuthController::class, 'register'])->name('auth.register');
Route::post('/login', [AuthController::class, 'login'])->name('auth.login');

// Authenticated (session cookie via Sanctum)
Route::middleware('auth:sanctum')->group(function () {
    Route::get('/user', [AuthController::class, 'user'])->name('auth.user');
    Route::post('/logout', [AuthController::class, 'logout'])->name('auth.logout');

    Route::apiResource('customers', CustomerController::class);
});
