<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * One row per uploaded supplier invoice that the AI reads (see ExtractBill).
 *
 * The upload is kept in the row itself (base64) only until the queue worker has
 * processed it, then cleared. That way the API and the worker containers don't
 * need a shared disk, and no document outlives its extraction.
 * The rows also count towards the daily usage limits.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('bill_extractions', function (Blueprint $table) {
            // ULID: the id appears in polling URLs, so it shouldn't be guessable or reveal volume.
            $table->ulid('id')->primary();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('status', 16)->default('pending');

            $table->string('original_filename');
            $table->string('mime', 64);
            $table->unsignedInteger('size'); // bytes
            $table->longText('file_contents')->nullable();

            $table->json('result')->nullable();   // pre-filled bill, shaped for the form
            $table->json('warnings')->nullable(); // [{field, message}]
            $table->string('error')->nullable();  // safe to show to the user

            $table->string('model', 100)->nullable();
            $table->unsignedInteger('duration_ms')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'created_at']);
            $table->index('created_at'); // the global daily limit
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bill_extractions');
    }
};
