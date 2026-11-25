<?php

namespace App\Extraction;

/** One image sent to the model: a photo, or one rendered page of a PDF. */
final readonly class DocumentPage
{
    public function __construct(
        public string $mime,
        public string $base64,
    ) {}

    public function dataUri(): string
    {
        return "data:{$this->mime};base64,{$this->base64}";
    }
}
