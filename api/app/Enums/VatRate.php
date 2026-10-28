<?php

namespace App\Enums;

/**
 * UAE VAT treatment per line item.
 * Zero-rated (e.g. exports) and exempt (e.g. residential rent) both charge 0%,
 * but they're reported differently on the VAT return, so they're kept apart.
 */
enum VatRate: string
{
    case Standard = 'standard';
    case Zero = 'zero';
    case Exempt = 'exempt';

    public function percent(): int
    {
        return match ($this) {
            self::Standard => 5,
            self::Zero, self::Exempt => 0,
        };
    }

    public function label(): string
    {
        return match ($this) {
            self::Standard => 'VAT 5%',
            self::Zero => 'Zero-rated',
            self::Exempt => 'Exempt',
        };
    }
}
