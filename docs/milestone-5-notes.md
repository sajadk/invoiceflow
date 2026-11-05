# Milestone 5 — Payments + dashboard

## Files to read, in order

**Laravel**
1. `database/migrations/2026_11_04_000001_create_payments_table.php`: new table, `amount_paid` column, and a data backfill
2. `app/Actions/Payments/RecordPayment.php` and `DeletePayment.php`: row locks, status changes
3. `app/Models/Invoice.php`: `balanceDue()`, `displayStatus()` with *partially paid*, void rules
4. `app/Queries/DashboardSummary.php`: every dashboard figure as a grouped SQL query
5. `tests/Feature/Payments/PaymentApiTest.php` and `tests/Feature/Dashboard/DashboardTest.php`

**React**
1. `features/payments/schema.ts`: a Zod schema *factory* (rules depend on the invoice)
2. `features/payments/RecordPaymentDialog.tsx`
3. `features/invoices/hooks.ts` → `useWriteThrough`: one helper, reused by payment mutations
4. `features/dashboard/RevenueChart.tsx` (Recharts) and `AgingCard.tsx` (plain Tailwind bars)
5. `pages/DashboardPage.tsx`, `pages/PaymentsPage.tsx`

## Design decisions (and the interview answers)

**Payments are records; "paid" is a consequence.** In milestone 4 "Mark as paid" flipped a status. Now money comes in as payment rows (amount, date, method, reference), and the status follows: when `amount_paid` reaches `total`, the invoice becomes *paid*. Deleting a payment reopens it. *Partially paid* is derived, like *overdue*, and overdue wins when both apply, because that's the one to chase.

**Why store `amount_paid` instead of summing payments every time?** The invoice list, the overdue filter and the dashboard all need `total - amount_paid` inside SQL (`WHERE`, `SUM`, `GROUP BY`). A stored running total keeps those queries simple and indexed. The cost is keeping it correct, so it's only ever changed inside `RecordPayment` and `DeletePayment`, in a transaction with the invoice row locked.

**The overpayment race.** Two people record the last AED 500 at the same moment: both read "balance 500", both pass validation, the invoice ends up overpaid. `RecordPayment` re-reads the invoice with `lockForUpdate()`, so the second request waits, sees balance 0 and gets a 422. That's why the "not more than the balance" rule is in the action, not in the Form Request.

**Data migrations.** Invoices marked paid in milestone 4 had no payment rows. The migration backfills one payment per paid invoice, so the books stay consistent. Schema changes and data fixes ship together.

**Void rules.** You can't void an invoice that has money recorded against it (409). Delete the payments first. This mirrors how accountants treat it: a receipt must be reversed explicitly, not hidden by voiding.

**Dashboard queries.** Everything is aggregated in MySQL (`SUM`, `COUNT`, `GROUP BY DATE_FORMAT(...)`, an aging `CASE` on `DATEDIFF`) rather than loading invoices into PHP. "Today" is passed as a bound parameter in the app timezone (Asia/Dubai) instead of `CURDATE()`. That way the server clock's timezone doesn't matter, and tests can freeze time with `Carbon::setTestNow()`.

**What the numbers mean:**
- **Outstanding** = sent invoices' unpaid balances. Drafts aren't owed yet; voids never are.
- **Overdue** = the outstanding part that's past its due date.
- **Collected** = payments by *payment date* (cash basis). **Invoiced** = invoices by *issue date* (accrual basis). Showing both side by side is the classic "are we actually getting paid?" view.
- **VAT this quarter** = output VAT on invoices issued in the quarter. UAE VAT returns are usually quarterly, and VAT is due on issue, not on payment.
- **Aging** = 0–30 / 31–60 / 61–90 / 90+ days past due: the receivables aging report every finance team uses.

## Vue → React, new in this milestone

| Vue 3 | React | Where |
|---|---|---|
| A computed validation schema that depends on props | `useMemo(() => paymentFormSchema({ balanceDue }), [balanceDue])` | `RecordPaymentDialog.tsx` |
| Reusing logic across stores | Exporting a hook (`useWriteThrough`) and calling it in another feature's hooks | `payments/hooks.ts` |
| vue-chartjs / ApexCharts | Recharts: charts are components (`<BarChart><Bar/></BarChart>`), configured with props | `RevenueChart.tsx` |
| `<component :is>` for a link-or-div wrapper | A conditional return of `<Link>` or `<div>` around the same `body` | `StatTile.tsx` |

### Cache invalidation, now across features
A payment changes the invoice (balance, status), the invoice lists, the payments list and the dashboard. Both payment endpoints return the **updated invoice**, so `useWriteThrough` puts it into the detail cache (the invoice page updates instantly, no refetch) and invalidates `['invoices','list']`, `['payments']` and `['dashboard']`. Those refetch only when they're next on screen, because invalidating a query nobody is watching just marks it stale.

### Accessible charts
The chart's SVG is `aria-hidden`, and a visually hidden `<table>` carries the same numbers for screen readers. Colour is never the only signal: the aging bars also show labels and amounts.

## Known limitations / next steps
- **Overpayments and credit notes** are refused, not recorded. A real system would allow an overpayment as customer credit, and use credit notes (not voids) to reduce an issued invoice.
- **Payment receipts** (PDF/email to the customer) aren't generated.
- **Multi-currency** payments and FX differences are out of scope; everything is AED.
- `DATE_FORMAT` / `DATEDIFF` are MySQL-specific. On Postgres they'd be `to_char` / date subtraction.
