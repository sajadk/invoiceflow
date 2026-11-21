<?php

namespace App\Models;

use App\Enums\BillStatus;
use App\Exceptions\BillStateException;
use App\Models\Concerns\HasVatBreakdown;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * A supplier invoice the business has received.
 *
 * @property int $id
 * @property int $user_id
 * @property string $supplier_name
 * @property string|null $supplier_trn
 * @property string $supplier_invoice_number
 * @property BillStatus $status
 * @property Carbon $issue_date
 * @property Carbon|null $due_date
 * @property string $currency
 * @property int $subtotal
 * @property int $vat_total
 * @property int $total
 * @property string|null $notes
 * @property Carbon|null $paid_at
 */
class Bill extends Model
{
    use HasVatBreakdown;

    protected $fillable = [
        'supplier_name',
        'supplier_trn',
        'supplier_invoice_number',
        'issue_date',
        'due_date',
        'notes',
    ];

    protected $attributes = [
        'status' => 'unpaid',
        'currency' => 'AED',
        'subtotal' => 0,
        'vat_total' => 0,
        'total' => 0,
    ];

    protected function casts(): array
    {
        return [
            'status' => BillStatus::class,
            'issue_date' => 'date',
            'due_date' => 'date',
            'subtotal' => 'integer',
            'vat_total' => 'integer',
            'total' => 'integer',
            'paid_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** @return HasMany<BillItem, $this> */
    public function items(): HasMany
    {
        return $this->hasMany(BillItem::class)->orderBy('position');
    }

    /** Unpaid and past its due date ("overdue" is derived, never stored). */
    public function scopeOverdue(Builder $query): void
    {
        $query->where('status', BillStatus::Unpaid)
            ->whereNotNull('due_date')
            ->whereDate('due_date', '<', today());
    }

    public function isOverdue(): bool
    {
        return $this->status === BillStatus::Unpaid
            && $this->due_date !== null
            && $this->due_date->lt(today());
    }

    public function displayStatus(): string
    {
        return $this->isOverdue() ? 'overdue' : $this->status->value;
    }

    public function ensureIsUnpaid(string $action): void
    {
        if ($this->status !== BillStatus::Unpaid) {
            throw new BillStateException("Paid bills can't be {$action}. Mark it as unpaid first.");
        }
    }

    public function markAsPaid(): void
    {
        if ($this->status === BillStatus::Paid) {
            throw new BillStateException('This bill is already marked as paid.');
        }

        $this->forceFill(['status' => BillStatus::Paid, 'paid_at' => now()])->save();
    }

    public function markAsUnpaid(): void
    {
        if ($this->status !== BillStatus::Paid) {
            throw new BillStateException('This bill is already unpaid.');
        }

        $this->forceFill(['status' => BillStatus::Unpaid, 'paid_at' => null])->save();
    }
}
