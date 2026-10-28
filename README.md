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
| MySQL | `localhost:3307` (or `MYSQL_HOST_PORT` from a root `.env`) · user `invoiceflow` / `secret` |

**Demo account:** `demo@invoiceflow.test` / `password`, with 32 sample customers (created by `make seed`).

Other commands: `make test`, `make seed`, `make shell`, `make tinker`, `make fresh`, `make down`.

Tests run against a separate `invoiceflow_testing` database (`api/.env.testing`), so they never touch your dev data. On an existing MySQL volume, create it once with `make test-db`.

## Authentication

Sanctum **SPA cookie authentication**: no tokens in the browser.

1. `GET /sanctum/csrf-cookie` sets the `XSRF-TOKEN` cookie.
2. `POST /api/login` checks the credentials, regenerates the session and sets an `HttpOnly` session cookie.
3. Every later request is authenticated by that cookie. `auth:sanctum` protects the API routes.

On the frontend, an `AuthProvider` (React Context backed by TanStack Query) exposes `useAuth()`. `ProtectedRoute` and `GuestRoute` layout routes handle redirects. Login attempts are rate-limited per email and IP.

| Method | Endpoint | Auth |
|---|---|---|
| GET | `/api/health` | — |
| POST | `/api/register` | — |
| POST | `/api/login` | — |
| GET | `/api/user` | session |
| POST | `/api/logout` | session |
| GET | `/api/customers?search=&emirate=&sort=-created_at&page=` | session |
| POST | `/api/customers` | session |
| GET / PUT / DELETE | `/api/customers/{id}` | session (owner only) |

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

## Customers

Server-side search (name, email, TRN), emirate filter, sorting and pagination. Every filter lives in the URL, so views can be bookmarked and shared. Create and edit happen in a slide-over form (React Hook Form + Zod, with server 422 errors mapped back onto fields), and deletes are optimistic with rollback. Customers are scoped to their owner; other users' records return 404.

## Roadmap

- [x] Scaffold: Docker, Laravel API, React + TS + Tailwind, end-to-end health check
- [x] Authentication with Sanctum SPA cookies, protected routes
- [x] Customers (TRN validation, server-side pagination and search)
- [ ] Invoices with line items, live VAT totals, statuses, PDF
- [ ] Payments and dashboard (revenue chart, aging)
- [ ] Tests (Vitest, Testing Library, PHPUnit) and GitHub Actions CI
- [ ] AWS deploy (S3 + CloudFront, EC2 + RDS)
