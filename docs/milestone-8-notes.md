# Milestone 8 — Bills and the VAT return

## Why bills, before AI capture

InvoiceFlow handled one side of the books: **sales** invoices, which carry **output VAT** the business owes. A supplier's invoice is the other side: a **bill**, carrying **input VAT** the business can reclaim. A UAE VAT return is essentially:

```
VAT payable = output VAT (sales) − input VAT (purchases)
```

So bills come first, as a feature in their own right. AI capture (next milestone) then fills in the *bill* form from an uploaded supplier invoice, instead of muddling purchases into the sales invoice form.

## Files to read

**Laravel**
1. `app/Http/Requests/Concerns/ValidatesLineItems.php`: line-item rules shared by `InvoiceRequest` and `BillRequest`
2. `app/Models/Concerns/HasVatBreakdown.php`: one VAT breakdown for both document types
3. `app/Models/Bill.php`, `app/Actions/Bills/SaveBill.php`: same calculator, simpler lifecycle (unpaid ⇄ paid)
4. `app/Http/Requests/Bills/BillRequest.php`: duplicate supplier-invoice detection
5. `app/Queries/DashboardSummary.php` → `vatForQuarter()`, `inPeriod()`
6. `database/seeders/Data/DemoCompanies.php`: why demo data uses obviously fictional names

**React**
1. `features/invoices/LineItemsEditor.tsx`: now a **generic component** used by both forms
2. `features/invoices/schema.ts`: `lineItemSchema`, `itemsToForm`, `itemsToPayload` shared with bills
3. `features/bills/`: same structure as invoices: api → queryKeys → hooks → schema → form
4. `pages/BillsPage.tsx`, `BillDetailPage.tsx`

## Design decisions (and the interview answers)

**Reuse through shared rules, not inheritance.** Invoices and bills share line items, VAT treatments and rounding. Rather than a base "Document" model, the shared parts are small units: a validation trait, a VAT-breakdown trait, the existing `InvoiceCalculator`, and on the frontend one line-item schema and one editor component. Each document keeps its own lifecycle: invoices go draft → sent → paid/void with gap-free numbering; bills are simply unpaid ⇄ paid, because the supplier assigned the number.

**Supplier details live on the bill.** A bill records a document someone else issued, so the supplier's name, TRN and number are stored as printed. There's no supplier table yet; one could be added later for autocomplete without changing bills.

**Duplicate protection.** The same supplier invoice number from the same supplier is refused per user. Recording a bill twice would double-claim its VAT, which is exactly the kind of error a tax audit finds.

**"No TRN" is allowed, but flagged.** Small suppliers may not be VAT-registered. The bill page warns when VAT is charged without a supplier TRN, because a valid tax invoice normally needs one to reclaim the VAT.

**Inclusive date ranges that work on every database.** On SQLite (tests), Eloquent stores dates as `"2026-03-31 00:00:00"`, and `whereBetween('issue_date', ['…01', '…31'])` silently drops rows dated on the last day. `inPeriod()` uses `whereDate` on both ends, and the dashboard test now includes a bill dated on the quarter's last day to prove it.

**Fictional demo data.** Faker builds company names from surnames ("Senger FZE"), and some of those exist. Demo names now all start with Example / Sample / Demo / Placeholder, emails use the reserved `.example` domain, and TRNs follow an obvious sample pattern (`100 0000 000x xxxx`).

## Vue → React: generic components

`LineItemsEditor<T extends { items: LineItemFormValues[] }>` accepts any form that has an `items` array: the invoice form and the bill form. TypeScript can't prove that the string `'items'` is a valid field path for *every* possible `T`, although the constraint guarantees it, so the component makes a few narrowly scoped casts at that boundary. Everything callers touch stays fully typed. Vue's closest equivalent is a component with `generic="T"` in `<script setup>`.
