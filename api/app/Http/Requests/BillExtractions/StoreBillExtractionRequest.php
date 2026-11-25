<?php

namespace App\Http\Requests\BillExtractions;

use Illuminate\Foundation\Http\FormRequest;

class StoreBillExtractionRequest extends FormRequest
{
    /** What the browser may upload. The type is checked from the file's contents, not its name. */
    public const MIMES = ['pdf', 'jpg', 'jpeg', 'png', 'webp'];

    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        return [
            'file' => [
                'required',
                'file',
                'mimes:'.implode(',', self::MIMES),
                'max:'.config('invoiceflow.extraction.max_file_kb'),
            ],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'file.required' => 'Choose a PDF or a photo of the invoice.',
            'file.mimes' => 'Upload a PDF, JPG, PNG or WebP file.',
            'file.max' => 'The file is too large. The limit is '.(config('invoiceflow.extraction.max_file_kb') / 1024).' MB.',
        ];
    }
}
