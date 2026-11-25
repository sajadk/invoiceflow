<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin \App\Models\BillExtraction
 */
class BillExtractionResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'status' => $this->status->value,
            'original_filename' => $this->original_filename,
            'mime' => $this->mime,
            'size' => $this->size,
            'result' => $this->result,
            'warnings' => $this->warnings ?? [],
            'error' => $this->error,
            'model' => $this->model,
            'duration_ms' => $this->duration_ms,
            'completed_at' => $this->completed_at?->toIso8601String(),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
