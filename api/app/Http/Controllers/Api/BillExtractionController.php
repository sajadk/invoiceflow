<?php

namespace App\Http\Controllers\Api;

use App\Extraction\ExtractionQuota;
use App\Http\Controllers\Controller;
use App\Http\Requests\BillExtractions\StoreBillExtractionRequest;
use App\Http\Resources\BillExtractionResource;
use App\Jobs\ExtractBill;
use App\Models\BillExtraction;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

/**
 * AI invoice capture. Upload → 202 with an id → the browser polls until the
 * queue worker has read the document → the user reviews a pre-filled bill form
 * and saves it through the normal POST /api/bills.
 */
class BillExtractionController extends Controller
{
    public function __construct(private readonly ExtractionQuota $quota) {}

    /**
     * GET /api/bill-extractions/usage: whether capture is available, and how many uploads are left today.
     */
    public function usage(Request $request): JsonResponse
    {
        return response()->json(['data' => [
            'enabled' => self::isConfigured(),
            ...$this->quota->usage($request->user()),
            'max_file_kb' => (int) config('invoiceflow.extraction.max_file_kb'),
            'max_pages' => (int) config('invoiceflow.extraction.max_pages'),
        ]]);
    }

    /**
     * POST /api/bill-extractions (multipart, field "file")
     */
    public function store(StoreBillExtractionRequest $request): JsonResponse
    {
        abort_unless(self::isConfigured(), 503, 'AI capture isn’t set up on this server. Please enter the bill by hand.');

        $this->quota->ensureAvailable($request->user());

        $file = $request->file('file');

        $extraction = new BillExtraction([
            'original_filename' => mb_substr($file->getClientOriginalName(), 0, 255),
            'mime' => $file->getMimeType(), // sniffed from the contents
            'size' => $file->getSize(),
            'file_contents' => base64_encode($file->getContent()),
        ]);
        $extraction->user()->associate($request->user());
        $extraction->save();

        ExtractBill::dispatch($extraction->id);

        return (new BillExtractionResource($extraction->refresh()))->response()->setStatusCode(202);
    }

    /**
     * GET /api/bill-extractions/{id}: polled by the browser every couple of seconds.
     */
    public function show(BillExtraction $extraction): BillExtractionResource
    {
        Gate::authorize('view', $extraction);
        $extraction->failIfStale();

        return new BillExtractionResource($extraction);
    }

    private static function isConfigured(): bool
    {
        return filled(config('invoiceflow.extraction.api_key'));
    }
}
