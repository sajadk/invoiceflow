<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Supplier invoices ("bills"): the purchases side. Their VAT is input VAT,
 * which the business reclaims against the output VAT on its sales.
 * Money in integer fils, like invoices.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('bills', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();

            // Supplier details as printed on their invoice, kept on the bill itself:
            // a bill records a document someone else issued.
            $table->string('supplier_name');
            $table->char('supplier_trn', 15)->nullable();
            $table->string('supplier_invoice_number', 64);

            $table->string('status', 16)->default('unpaid');
            $table->date('issue_date');
            $table->date('due_date')->nullable();
            $table->char('currency', 3)->default('AED');

            $table->bigInteger('subtotal')->default(0);
            $table->bigInteger('vat_total')->default(0);
            $table->bigInteger('total')->default(0);

            $table->text('notes')->nullable();
            $table->timestamp('paid_at')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'status', 'due_date']);
            $table->index(['user_id', 'issue_date']);
            $table->index(['user_id', 'supplier_name']);
        });

        Schema::create('bill_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('bill_id')->constrained()->cascadeOnDelete();
            $table->unsignedSmallInteger('position');
            $table->string('description', 500);
            $table->decimal('quantity', 10, 3);
            $table->bigInteger('unit_price');
            $table->string('vat_rate', 16);
            $table->bigInteger('line_total');
            $table->timestamps();

            $table->index(['bill_id', 'position']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bill_items');
        Schema::dropIfExists('bills');
    }
};
