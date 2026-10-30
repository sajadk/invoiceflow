<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CustomerController;
use App\Http\Controllers\Api\HealthController;
use App\Http\Controllers\Api\InvoiceController;
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

    Route::apiResource('invoices', InvoiceController::class);
    Route::controller(InvoiceController::class)->prefix('invoices/{invoice}')->name('invoices.')->group(function () {
        Route::post('/send', 'send')->name('send');
        Route::post('/mark-paid', 'markPaid')->name('mark-paid');
        Route::post('/void', 'void')->name('void');
        Route::get('/pdf', 'pdf')->name('pdf');
    });
});
