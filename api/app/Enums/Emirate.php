<?php

namespace App\Enums;

enum Emirate: string
{
    case AbuDhabi = 'abu_dhabi';
    case Dubai = 'dubai';
    case Sharjah = 'sharjah';
    case Ajman = 'ajman';
    case UmmAlQuwain = 'umm_al_quwain';
    case RasAlKhaimah = 'ras_al_khaimah';
    case Fujairah = 'fujairah';

    public function label(): string
    {
        return match ($this) {
            self::AbuDhabi => 'Abu Dhabi',
            self::Dubai => 'Dubai',
            self::Sharjah => 'Sharjah',
            self::Ajman => 'Ajman',
            self::UmmAlQuwain => 'Umm Al Quwain',
            self::RasAlKhaimah => 'Ras Al Khaimah',
            self::Fujairah => 'Fujairah',
        };
    }
}
