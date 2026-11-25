<?php

namespace App\Enums;

enum ExtractionStatus: string
{
    case Pending = 'pending';       // uploaded, waiting for the queue worker
    case Processing = 'processing'; // the worker is talking to the AI
    case Completed = 'completed';   // result ready for review
    case Failed = 'failed';

    public function isFinished(): bool
    {
        return $this === self::Completed || $this === self::Failed;
    }
}
