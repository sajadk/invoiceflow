<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BillController;
use App\Http\Controllers\Api\BillExtractionController;
use App\Http\Controllers\Api\CustomerController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\HealthController;
use App\Http\Controllers\Api\InvoiceController;
use App\Http\Controllers\Api\PaymentController;
use App\Http\Middleware\VerifyOriginSecret;
use Illuminate\Support\Facades\Route;

// In production every request must arrive through CloudFront (see VerifyOriginSecret).
Route::middleware(VerifyOriginSecret::class)->group(function () {
    // Public
    Route::get('/health', HealthController::class)->name('health');

    Route::post('/register', [AuthController::class, 'register'])->name('auth.register');
    Route::post('/login', [AuthController::class, 'login'])->name('auth.login');

    // Authenticated (session cookie via Sanctum)
    Route::middleware('auth:sanctum')->group(function () {
        Route::get('/user', [AuthController::class, 'user'])->name('auth.user');
        Route::post('/logout', [AuthController::class, 'logout'])->name('auth.logout');

        Route::get('/dashboard', DashboardController::class)->name('dashboard');

        Route::apiResource('customers', CustomerController::class);

        Route::apiResource('invoices', InvoiceController::class);
        Route::controller(InvoiceController::class)->prefix('invoices/{invoice}')->name('invoices.')->group(function () {
            Route::post('/send', 'send')->name('send');
            Route::post('/void', 'void')->name('void');
            Route::get('/pdf', 'pdf')->name('pdf');
        });

        Route::apiResource('bills', BillController::class);
        Route::controller(BillController::class)->prefix('bills/{bill}')->name('bills.')->group(function () {
            Route::post('/mark-paid', 'markPaid')->name('mark-paid');
            Route::post('/mark-unpaid', 'markUnpaid')->name('mark-unpaid');
        });

        // AI invoice capture: upload, then poll until the queue worker has read it.
        Route::controller(BillExtractionController::class)->prefix('bill-extractions')->name('bill-extractions.')->group(function () {
            Route::get('/usage', 'usage')->name('usage');
            Route::post('/', 'store')->middleware('throttle:5,1')->name('store');
            Route::get('/{extraction}', 'show')->whereUlid('extraction')->name('show');
        });

        Route::get('/payments', [PaymentController::class, 'index'])->name('payments.index');
        Route::post('/invoices/{invoice}/payments', [PaymentController::class, 'store'])->name('payments.store');
        Route::delete('/payments/{payment}', [PaymentController::class, 'destroy'])->name('payments.destroy');
    });
});
