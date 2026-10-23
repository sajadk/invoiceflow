# InvoiceFlow

VAT invoicing and receivables for UAE small businesses: customers with TRNs, AED invoices with 5% VAT, payments, and an overdue aging dashboard.

**Stack:** React 19 · TypeScript · Vite · Tailwind CSS v4 · TanStack Query · React Router · Laravel · Sanctum · MySQL 8 · Docker

> 🚧 Work in progress. See the roadmap below.

## Architecture

```
Browser ──► web (Vite :5173) ──/api proxy──► api (Laravel :8000) ──► mysql (:3306)
```

- `/web` — React SPA. All API calls go to `/api`, so the browser only ever talks to one origin. Sanctum's session and XSRF cookies stay first-party, with no CORS juggling.
- `/api` — Laravel JSON API (API Resources, Form Requests, Policies).
- In production the same idea applies: CloudFront serves the SPA from S3 and routes `/api/*` to the Laravel origin.

## Getting started

Requirements: Docker Desktop and `make`.

```bash
make setup   # first run only: builds images, generates Laravel, installs Sanctum, migrates
make up      # starts mysql, api and web
```

| Service | URL |
|---|---|
| Web app | http://localhost:5173 |
| API health | http://localhost:8000/api/health |
| MySQL | `localhost:3307` · user `invoiceflow` / `secret` |

Other commands: `make test`, `make shell`, `make tinker`, `make fresh`, `make down`.

## Project structure

```
web/src/
  components/     shared UI and layout
  features/       one folder per domain: API calls, hooks, components
  lib/            axios instance, query client
  pages/          route-level components
  router.tsx
api/
  app/Http/Controllers/Api/
  routes/api.php
docker/api/       dev image + setup script
```

## Roadmap

- [x] Scaffold: Docker, Laravel API, React + TS + Tailwind, end-to-end health check
- [ ] Authentication with Sanctum SPA cookies, protected routes
- [ ] Customers (TRN validation, server-side pagination and search)
- [ ] Invoices with line items, live VAT totals, statuses, PDF
- [ ] Payments and dashboard (revenue chart, aging)
- [ ] Tests (Vitest, Testing Library, PHPUnit) and GitHub Actions CI
- [ ] AWS deploy (S3 + CloudFront, EC2 + RDS)
