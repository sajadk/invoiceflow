# Milestone 4 — Invoices + VAT

## Files to read, in order

**Laravel**
1. `app/Support/InvoiceCalculator.php` + `tests/Unit/InvoiceCalculatorTest.php`: all the money maths
2. `app/Actions/Invoices/SaveDraftInvoice.php` and `SendInvoice.php`: business operations as single-purpose classes
3. `app/Models/Invoice.php`: status transitions, derived "overdue"
4. `app/Exceptions/InvoiceStateException.php`: why wrong-state actions return 409
5. `app/Http/Controllers/Api/InvoiceController.php`: a thin controller that delegates
6. `resources/views/pdf/invoice.blade.php`

**React**
1. `features/invoices/money.ts`: the browser mirror of `InvoiceCalculator.php`
2. `features/invoices/schema.ts`: Zod schema with a nested array and a cross-field rule
3. `features/invoices/LineItemsEditor.tsx` + `InvoiceForm.tsx`: `useFieldArray`, `useWatch`, live totals
4. `pages/InvoiceDetailPage.tsx`: actions per status, confirm dialogs, Blob download
5. `features/invoices/hooks.ts`: "write-through" cache updates

## Design decisions (and the interview answers)

**Money is integer fils, never floats.** `0.1 + 0.2 === 0.30000000000000004`. Every amount is stored and sent as an integer number of fils (AED × 100). Input like `"1,250.50"` is parsed as text, never with `parseFloat`. Rounding is half-up with integer division (`intdiv` in PHP, `Math.floor((n + 500) / 1000)` in TS), so both languages produce identical numbers. The same test cases run against both.

**VAT is rounded once per rate, on the sum.** Rounding each line separately can drift by a few fils on long invoices. Grouping by treatment (standard 5%, zero-rated, exempt) is also what the UAE VAT return needs: zero-rated and exempt sales are both 0% but are reported in different boxes.

**The server is the source of truth for totals.** The browser calculates live totals for the user, but the API ignores any totals sent to it and recalculates from quantity × unit price. There's a test sending a fake `total` to prove it.

**State machine: draft → sent → paid / void.**
- Drafts are freely editable and deletable, and have no number.
- **Sending** assigns the next number (`INV-2026-0007`) and freezes the customer's details into `billed_to`. A tax invoice must show who it was issued to *at that time*, even if the customer is renamed or deleted later.
- Sent invoices are never edited or deleted, only voided. Numbers have no gaps, which auditors expect.
- **Overdue isn't stored.** It's derived from `status = sent AND due_date < today`, so it can't go stale and needs no cron job.
- Wrong-state actions throw `InvoiceStateException` → **409 Conflict** (the request is valid, but conflicts with the resource's current state), distinct from 403 (not yours: returned as 404 here) and 422 (bad input).

**Race-free numbering.** Two invoices sent in the same millisecond could both read "last sequence = 6". `SendInvoice` runs in a transaction and takes a row lock (`lockForUpdate`) on the user, so number allocation is serialized per user. There's also a unique index on `(user_id, sequence)` as a backstop.

**Actions over fat controllers.** `SaveDraftInvoice` and `SendInvoice` hold the business logic; the controller only authorizes, validates and returns resources. The seeder uses the same actions, so demo data follows the same rules as real data.

## Vue → React, new in this milestone

| Vue 3 | React | Where |
|---|---|---|
| `v-for` over a reactive array of sub-forms | `useFieldArray` → `fields`, `append`, `remove`, `move` | `LineItemsEditor.tsx` |
| `:key="item.id"` | `key={field.id}`: RHF generates stable ids; **never the index** for editable lists | `LineItemsEditor.tsx` |
| `computed(() => totals(form.items))` | `useWatch({ name: 'items' })` + a plain calculation in the render | `InvoiceForm.tsx` |
| `useRoute().params.id` | `useParams()` | `InvoiceDetailPage.tsx` |
| Route-level `beforeEnter` redirect | Render `<Navigate replace />` (sent invoices can't open the edit page) | `InvoiceEditPage.tsx` |

### Why `useWatch` and not `watch()`?
`watch()` from `useForm` re-renders the **whole form** on every change. `useWatch` subscribes only the component that calls it. Here that's still the form (for the totals panel), but the pattern lets you push the subscription down into a small `<Totals>` component if the form grows.

### "Write-through" caching
Create, update and every status action return the full invoice. `useWriteThrough` puts it straight into the detail cache with `setQueryData` (the detail page renders instantly after "Save draft", with no loading spinner) and only marks *lists* stale.

### Downloading a file through the API
The PDF comes from `axios.get(…, { responseType: 'blob' })` rather than an `<a href>`, so it goes through the same session, CSRF and error handling as every other call. The Blob is turned into a temporary object URL and clicked, and the URL is revoked afterwards to free memory.

## Known limitations (good "what would you do next?" answers)
- **Seller details on the PDF** use the account name and email. A UAE tax invoice also needs the *supplier's* TRN and address, so a "Business profile" settings page is the natural next step.
- **Customer picker** loads up to 100 customers. Beyond that, it should become an async searchable combobox.
- **Partial payments** arrive in milestone 5. "Mark as paid" will become "Record payment", and paid/partially paid will be derived from payments.
- **Multi-currency**: the `currency` column exists but is fixed to AED. Supporting more needs an FX rate captured at issue time and AED equivalents for VAT reporting.
