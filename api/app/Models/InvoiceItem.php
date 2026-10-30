<?php

namespace App\Models;

use App\Enums\VatRate;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $invoice_id
 * @property int $position
 * @property string $description
 * @property string $quantity
 * @property int $unit_price
 * @property VatRate $vat_rate
 * @property int $line_total
 */
class InvoiceItem extends Model
{
    protected $fillable = [
        'position',
        'description',
        'quantity',
        'unit_price',
        'vat_rate',
        'line_total',
    ];

    protected function casts(): array
    {
        return [
            'position' => 'integer',
            'quantity' => 'decimal:3',
            'unit_price' => 'integer',
            'vat_rate' => VatRate::class,
            'line_total' => 'integer',
        ];
    }

    /** @return BelongsTo<Invoice, $this> */
    public function invoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class);
    }
}
