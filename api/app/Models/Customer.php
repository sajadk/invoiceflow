<?php

namespace App\Models;

use App\Enums\Emirate;
use Database\Factories\CustomerFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * @property int $id
 * @property int $user_id
 * @property string $name
 * @property string|null $email
 * @property string|null $phone
 * @property string|null $trn
 * @property Emirate|null $emirate
 * @property string|null $address
 */
class Customer extends Model
{
    /** @use HasFactory<CustomerFactory> */
    use HasFactory;

    use SoftDeletes;

    /** user_id is deliberately not fillable: ownership is set by the controller, never by request input. */
    protected $fillable = [
        'name',
        'email',
        'phone',
        'trn',
        'emirate',
        'address',
    ];

    protected function casts(): array
    {
        return [
            'emirate' => Emirate::class,
        ];
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
