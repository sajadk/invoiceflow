<?php

namespace App\Models;

use App\Enums\PaymentMethod;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $user_id
 * @property int $invoice_id
 * @property int $amount
 * @property Carbon $paid_on
 * @property PaymentMethod $method
 * @property string|null $reference
 * @property string|null $notes
 */
class Payment extends Model
{
    /** user_id and invoice_id are set by RecordPayment, never mass-assigned from input. */
    protected $fillable = [
        'amount',
        'paid_on',
        'method',
        'reference',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'integer',
            'paid_on' => 'date',
            'method' => PaymentMethod::class,
        ];
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** @return BelongsTo<Invoice, $this> */
    public function invoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class);
    }
}
