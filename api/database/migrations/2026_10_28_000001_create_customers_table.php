<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('customers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('email')->nullable();
            $table->string('phone', 30)->nullable();
            // UAE Tax Registration Number: 15 digits. Required on tax invoices for VAT-registered customers.
            $table->char('trn', 15)->nullable();
            $table->string('emirate', 20)->nullable();
            $table->text('address')->nullable();
            $table->timestamps();
            // Soft deletes: invoices (next milestone) must keep pointing at the customer they were issued to.
            $table->softDeletes();

            $table->index(['user_id', 'name']);
            $table->index(['user_id', 'trn']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('customers');
    }
};
