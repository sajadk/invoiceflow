# Milestone 6 — Tests + CI

## Files to read, in order

1. `web/src/test/setup.ts`, `server.ts`, `render.tsx`: the test harness (jest-dom matchers, MSW, providers)
2. `web/src/features/invoices/money.test.ts`: the same cases as `api/tests/Unit/InvoiceCalculatorTest.php`
3. `web/src/features/payments/schema.test.ts`: a frozen clock with `vi.setSystemTime`
4. `web/src/features/invoices/InvoiceForm.test.tsx`: a user-level component test with a mocked API
5. `web/src/features/auth/authRouting.test.tsx`: route guards and the login redirect, with the real router
6. `.github/workflows/ci.yml`

## What's worth testing in a React app (the interview answer)

The rule of thumb is **test behaviour, not implementation** (Testing Library's "the more your tests resemble the way your software is used, the more confidence they give you").

| Layer | Tool | Example here | Why |
|---|---|---|---|
| Pure logic | Vitest | `money.test.ts`, `schema.test.ts` | Fast, exhaustive edge cases: rounding, parsing, date rules |
| Components + data | Testing Library + MSW | `InvoiceForm.test.tsx` | Real hooks, real axios, real validation; only the network is fake |
| Routing / auth flows | Testing Library + `createMemoryRouter` | `authRouting.test.tsx` | Guards and redirects break silently otherwise |
| API contract and rules | PHPUnit feature tests | `api/tests/Feature/**` | The server is the source of truth: ownership, state, totals |

What I **don't** test: Tailwind classes, that `useState` works, snapshot dumps of markup. They break on every refactor and catch nothing.

### Why MSW instead of `vi.mock('./api')`?
Mocking our own modules tests that we called a function. MSW intercepts the **HTTP request**, so the test covers the axios instance, the interceptors, the URL, the JSON body and the error mapping (`getFieldErrors` turning a 422 into field errors). The test asserts what goes over the wire: `unit_price: 100000` (fils), `quantity: '1.500'`. `onUnhandledRequest: 'error'` makes any request a test didn't expect fail loudly.

### Queries by role and label
`getByLabelText('Unit price (AED)')` only works if the input really has that accessible name, so the tests double as an accessibility check. If a label is broken, a test fails.

### One set of cases, two languages
`money.test.ts` and `InvoiceCalculatorTest.php` assert the same inputs and outputs: half-up rounding, 3-decimal quantities, VAT rounded once per rate, the largest allowed line. The browser's live totals are a preview of the server's calculation, and this pair of suites is what guarantees they agree.

## CI design

- **Two jobs in parallel:** `api` (PHP) and `web` (Node). Each installs with a lockfile (`composer.lock`, `npm ci`), so CI builds exactly what was tested locally.
- **API matrix: SQLite and MySQL.** Locally, `phpunit.xml` runs tests on in-memory SQLite for speed. Production is MySQL. Milestone 5 hit exactly this gap (`DATE_FORMAT` exists in MySQL, not SQLite). Running both catches dialect-specific SQL in either direction. Environment variables set in the workflow override `phpunit.xml`'s `<env>` defaults, so no second config file is needed.
- **Web job:** typecheck → lint → tests → production build. The build step catches things tests don't, such as a broken import in a page no test renders.
- `concurrency` cancels an older run when you push again; `permissions: contents: read` gives the workflow the least access it needs.

**Make CI a merge gate:** on GitHub, go to Settings → Branches → add a branch protection rule (or ruleset) for `main` → require status checks to pass, and pick the three CI checks. Then a red build can't be merged.

## Vue → React testing, side by side

| Vue | React |
|---|---|
| `@vue/test-utils` `mount()` + `wrapper.find()` | `@testing-library/react` `render()` + `screen.getByRole()` |
| `@testing-library/vue` | the same API, so the habits transfer directly |
| `wrapper.setValue()` / `trigger('click')` | `userEvent.type()` / `userEvent.click()` (real event sequences) |
| `await nextTick()` / `flushPromises()` | `await screen.findBy…()` / `waitFor()`: retry until it appears |
| Providing a Pinia testing store | Wrapping in `QueryClientProvider` with a fresh `QueryClient` per test |

## Next steps (optional)
- **Coverage:** `vitest run --coverage` with `@vitest/coverage-v8`; report it in CI rather than chasing a percentage.
- **End-to-end:** a couple of Playwright tests (log in, create and send an invoice, record a payment) against the Docker stack would cover the real browser + API together.
- **Static analysis:** Larastan (PHPStan for Laravel) and Laravel Pint in the API job.
