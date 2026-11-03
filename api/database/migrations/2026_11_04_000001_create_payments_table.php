<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('invoice_id')->constrained()->cascadeOnDelete();
            $table->bigInteger('amount'); // fils
            $table->date('paid_on');
            $table->string('method', 20);
            $table->string('reference', 100)->nullable(); // bank ref, cheque number…
            $table->string('notes', 500)->nullable();
            $table->timestamps();

            $table->index(['user_id', 'paid_on']);
            $table->index(['invoice_id', 'paid_on']);
        });

        // Running total of payments, kept in step by RecordPayment / DeletePayment.
        // Stored (not summed on every read) so lists, filters and the dashboard can
        // use "total - amount_paid" directly in SQL.
        Schema::table('invoices', function (Blueprint $table) {
            $table->bigInteger('amount_paid')->default(0)->after('total');
        });

        // Invoices marked paid in milestone 4 had no payment record: give each one a
        // single payment for its full total, so the books stay consistent.
        DB::table('invoices')->where('status', 'paid')->orderBy('id')->each(function (object $invoice) {
            DB::table('payments')->insert([
                'user_id' => $invoice->user_id,
                'invoice_id' => $invoice->id,
                'amount' => $invoice->total,
                'paid_on' => substr((string) ($invoice->paid_at ?? $invoice->updated_at), 0, 10),
                'method' => 'bank_transfer',
                'notes' => 'Recorded before payment tracking was added',
                'created_at' => now(),
                'updated_at' => now(),
            ]);
            DB::table('invoices')->where('id', $invoice->id)->update(['amount_paid' => $invoice->total]);
        });
    }

    public function down(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            $table->dropColumn('amount_paid');
        });
        Schema::dropIfExists('payments');
    }
};
