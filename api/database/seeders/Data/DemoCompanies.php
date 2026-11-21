<?php

namespace Database\Seeders\Data;

/**
 * Company names for demo data. Every name starts with Example, Sample, Demo or
 * Placeholder, so none can be mistaken for (or belong to) a real business.
 * Faker's surname-based names ("Senger FZE") can coincide with real companies.
 */
final class DemoCompanies
{
    private const PREFIXES = ['Example', 'Sample', 'Demo', 'Placeholder'];

    private const CUSTOMER_TRADES = [
        'Trading LLC', 'Logistics FZE', 'Media FZ-LLC', 'Foods LLC', 'Retail LLC',
        'Technical Services LLC', 'Contracting LLC', 'Interiors FZE', 'Events FZ-LLC', 'Consulting FZE',
    ];

    public const SUPPLIERS = [
        'Example Office Supplies LLC',
        'Sample Cloud Hosting FZ-LLC',
        'Demo Telecom Services LLC',
        'Placeholder Freight Forwarding FZE',
        'Example Printing Press LLC',
        'Sample Facilities Management LLC',
        'Demo Software Licensing FZ-LLC',
        'Placeholder Catering LLC',
    ];

    /** @return list<string> 40 distinct customer names. */
    public static function customers(): array
    {
        $names = [];
        foreach (self::CUSTOMER_TRADES as $trade) {
            foreach (self::PREFIXES as $prefix) {
                $names[] = "{$prefix} {$trade}";
            }
        }

        return $names;
    }

    /** accounts@sample-logistics.example: ".example" is reserved for documentation. */
    public static function emailFor(string $name): string
    {
        $slug = str($name)->replaceMatches('/\b(FZ-LLC|LLC|FZE)\b/', '')->slug()->toString();

        return "accounts@{$slug}.example";
    }

    /** An obviously-sample TRN (100 0000 000x xxxx). A random 15-digit TRN could be a real one. */
    public static function sampleTrn(): string
    {
        return '1000000000'.fake()->numerify('#####');
    }
}
