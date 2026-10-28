# Milestone 3 — Customers (first full create, list, edit and delete flow)

## Files to read, in order

**Laravel**
1. `app/Http/Controllers/Api/CustomerController.php`: filtering, sorting and pagination in one query
2. `app/Http/Requests/Customers/CustomerRequest.php`: TRN normalisation, per-user unique rule, authorize-before-validate
3. `app/Policies/CustomerPolicy.php`: why another user's customer is a 404
4. `tests/Feature/Customers/CustomerApiTest.php`

**React**
1. `features/customers/queryKeys.ts` → `api.ts` → `hooks.ts` (queries, mutations, optimistic delete)
2. `features/customers/schema.ts` (Zod) → `CustomerForm.tsx` (React Hook Form)
3. `pages/CustomersPage.tsx`: URL-driven filters, debounced search, modals
4. `components/ui/Modal.tsx`: the native `<dialog>` bridged to React state

## Vue → React, new in this milestone

| Vue 3 | React | Where |
|---|---|---|
| `useRoute().query` + `router.replace({ query })` | `useSearchParams()` → `[params, setParams]` | `CustomersPage.tsx` |
| VeeValidate + Yup/Zod | React Hook Form + Zod (`zodResolver`) | `CustomerForm.tsx` |
| `v-model` on every input | `{...register('name')}`: RHF reads the DOM through refs (uncontrolled inputs) | `CustomerForm.tsx` |
| Template ref (`ref="dialog"`) + `watch` | `useRef` + `useEffect` | `Modal.tsx` |
| Scoped slot | Render-prop child: `{(control) => <input id={control.id} />}` | `FormField.tsx` |
| `:key` to force a re-mount | `key={customer.id}`: same trick, resets the form's defaults | `CustomersPage.tsx` |
| Pinia action calling the API, then refetching | `useMutation` + `invalidateQueries` | `hooks.ts` |
| `lodash.debounce` in `setup()` | `useDebouncedCallback` (custom hook, "latest ref" pattern) | `hooks/useDebouncedCallback.ts` |

### Concepts worth being able to explain

**Query keys are a hierarchy.** `['customers', 'list', { page: 2, search: 'gulf' }]` is one cached list. `invalidateQueries({ queryKey: ['customers', 'list'] })` marks *every* cached list stale at once. That's why a create or update doesn't need to know which page you're on.

**`placeholderData: keepPreviousData`.** When the page or search changes, the old rows stay on screen (dimmed) until the new ones arrive, instead of flashing a skeleton. `isPending` is only true on the very first load; `isFetching` is true on every background request.

**Optimistic delete, in four steps** (`useDeleteCustomer`):
1. `onMutate`: cancel in-flight list fetches (they'd overwrite the change), snapshot every cached list, remove the row from all of them.
2. Return the snapshots. They're passed to `onError` as `context`.
3. `onError`: put the snapshots back, so the row reappears.
4. `onSettled`: refetch either way, because the page boundaries shifted.

**Controlled vs uncontrolled forms.** The login page uses `useState` for every field (controlled): simple, but every keystroke re-renders the component. React Hook Form leaves the values in the DOM and only re-renders for errors and submit state, which is noticeably faster on large forms like the invoice editor coming next.

**Client and server validation.** Zod catches format problems instantly. Only the server can check things like "this TRN already exists for you". Its 422 response is mapped onto the same fields with `setError`, so the user sees one consistent error style.

**The URL as state.** Filters live in `?search=&emirate=&sort=&page=` rather than `useState`, so refresh, back/forward, bookmarks and shared links all work. The search input keeps its own local state for instant typing, and only writes to the URL after 300ms (`replace: true`, so every keystroke doesn't add a history entry).

## Interview talking points

- **Multi-tenant safety.** `user_id` isn't fillable; it comes from the session. Every query is scoped with `whereBelongsTo($request->user())`. There's a test proving that a `user_id` in the payload is ignored.
- **404 vs 403.** The policy uses `Response::denyAsNotFound()`, so you can't probe other users' IDs. The form request authorizes *before* validating, so even an invalid payload against someone else's customer returns 404, not 422.
- **UAE domain rules.** TRN is 15 digits starting with 100, normalised from pasted formats like `100-1234-5678-9012`, unique per user (ignoring soft-deleted customers). Emirates are a backed PHP enum with labels.
- **Soft deletes.** Invoices (the next milestone) must keep referencing the customer they were issued to; tax records in the UAE are kept for years.
- **Safe search.** User input in `LIKE` is escaped (`%` and `_`) and sort columns are allow-listed, because you can't bind column names in SQL.
- **Accessibility.** A native `<dialog>` gives focus trapping and Esc for free. Sortable headers expose `aria-sort`. Row actions include the customer name for screen readers ("Edit, Al Noor Trading").
