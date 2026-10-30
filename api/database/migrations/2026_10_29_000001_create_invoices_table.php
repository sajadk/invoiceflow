<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Money is stored as integer fils (1 AED = 100 fils), never floats:
 * 0.1 + 0.2 !== 0.3 is not a bug you want in an accounting app.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('invoices', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            // restrictOnDelete: a customer with invoices can be soft-deleted, never hard-deleted.
            $table->foreignId('customer_id')->constrained()->restrictOnDelete();

            // Assigned when the invoice is sent; drafts have no number.
            $table->unsignedInteger('sequence')->nullable();
            $table->string('number', 32)->nullable();

            $table->string('status', 16)->default('draft');
            $table->date('issue_date');
            $table->date('due_date');
            $table->char('currency', 3)->default('AED');

            $table->bigInteger('subtotal')->default(0);
            $table->bigInteger('vat_total')->default(0);
            $table->bigInteger('total')->default(0);

            // Customer details frozen at send time: a tax invoice must show who it
            // was issued to, even if the customer record changes later.
            $table->json('billed_to')->nullable();
            $table->text('notes')->nullable();

            $table->timestamp('sent_at')->nullable();
            $table->timestamp('paid_at')->nullable();
            $table->timestamp('voided_at')->nullable();
            $table->timestamps();

            $table->unique(['user_id', 'number']);
            $table->unique(['user_id', 'sequence']);
            $table->index(['user_id', 'status', 'due_date']);
            $table->index(['user_id', 'issue_date']);
        });

        Schema::create('invoice_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('invoice_id')->constrained()->cascadeOnDelete();
            $table->unsignedSmallInteger('position');
            $table->string('description', 500);
            $table->decimal('quantity', 10, 3);
            $table->bigInteger('unit_price'); // fils
            $table->string('vat_rate', 16);
            $table->bigInteger('line_total'); // fils, excluding VAT
            $table->timestamps();

            $table->index(['invoice_id', 'position']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('invoice_items');
        Schema::dropIfExists('invoices');
    }
};
