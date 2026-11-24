<?php

namespace App\Enums;

/** "Overdue" is derived (unpaid + past due date), like on invoices. */
enum BillStatus: string
{
    case Unpaid = 'unpaid';
    case Paid = 'paid';
}
