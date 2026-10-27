# Milestone 2 — Authentication with Sanctum SPA cookies

## How a login actually works

```
1. GET  /sanctum/csrf-cookie   → Laravel sets XSRF-TOKEN cookie (readable by JS)
2. POST /api/login             → axios copies XSRF-TOKEN into the X-XSRF-TOKEN header
                                 Laravel checks CSRF, checks password, regenerates the session
                                 → sets laravel_session cookie (HttpOnly: JS can never read it)
3. GET  /api/user              → browser sends the session cookie automatically → 200 { data: user }
```

Sanctum decides a request is "stateful" (uses the session) when its `Origin`/`Referer` matches `SANCTUM_STATEFUL_DOMAINS`. That's what `$middleware->statefulApi()` in `bootstrap/app.php` switches on.

## Files to read, in order

1. `api/app/Http/Controllers/Api/AuthController.php` + `Requests/Auth/LoginRequest.php`
2. `web/src/lib/api.ts`: CSRF cookie + automatic 419 retry
3. `web/src/features/auth/`: `api.ts` → `AuthContext.ts` → `AuthProvider.tsx` → `useAuth.ts`
4. `web/src/components/routing/ProtectedRoute.tsx` and `GuestRoute.tsx`
5. `web/src/router.tsx`: how the guards wrap routes
6. `web/src/pages/LoginPage.tsx`: state, controlled inputs, error handling

## Vue → React, new in this milestone

| Vue 3 | React | Where |
|---|---|---|
| `const email = ref('')` | `const [email, setEmail] = useState('')` | `LoginPage.tsx` |
| `form.email = 'x'` (mutate a `reactive`) | `setForm(prev => ({ ...prev, email: 'x' }))`: always a new object | `updateField` |
| `v-model="form.email"` | `value={form.email}` + `onChange={e => …}` ("controlled input") | `LoginPage.tsx` |
| `@submit.prevent` | `onSubmit={e => { e.preventDefault(); … }}` | `handleSubmit` |
| `provide(AuthKey, auth)` / `inject(AuthKey)` | `<AuthContext.Provider value>` / `useContext(AuthContext)` | `AuthProvider.tsx`, `useAuth.ts` |
| `onMounted` + `onUnmounted` | `useEffect(() => { setup; return cleanup }, [deps])` | 401 interceptor in `AuthProvider` |
| `computed()` | Plain variables in the body, or `useMemo` when it's expensive or identity matters | context `value` |
| Router `beforeEach` + `meta.requiresAuth` | A layout route component rendering `<Outlet/>` or `<Navigate/>` | `ProtectedRoute.tsx` |
| `router.push('/')` | `const navigate = useNavigate(); navigate('/')` | `LoginPage.tsx` |
| `$attrs` fallthrough | `...rest` props spread onto the element | `TextField.tsx` |

### Things that trip up Vue developers

- **State updates aren't immediate.** After `setForm(x)`, `form` still holds the old value until the next render. That's why updates use the function form `setForm(prev => …)`.
- **`useEffect` dependency array.** `[]` = run once on mount, `[a, b]` = re-run when a/b change, omitted = every render (rarely what you want). StrictMode deliberately mounts → unmounts → mounts in dev to prove your cleanup works, so you'll see effects fire twice locally.
- **Why `useCallback`/`useMemo` in the provider?** Every component that calls `useAuth()` re-renders when the context `value` changes identity. Memoising it means a re-render of the provider doesn't cascade into the whole app.
- **Context + TanStack Query together.** Query owns the *data* (fetched once, cached, invalidated on logout). Context only distributes it and the actions. Don't put server data in `useState` inside a context: you'd re-implement caching badly.

## Interview talking points

**"Why cookies instead of JWT in localStorage?"**
- A token in localStorage can be read by any JavaScript on the page, so one XSS bug leaks a long-lived credential. The session cookie is `HttpOnly`, so JS can't read it at all.
- Logout and revocation are real: the session is destroyed server-side. A stateless JWT stays valid until it expires unless you build a blocklist.
- Cookies bring CSRF risk, which Sanctum handles with the XSRF-TOKEN double-submit pattern plus SameSite=Lax cookies.
- When I'd still use tokens: mobile apps, third-party API consumers, or an SPA on a completely different domain. (Sanctum issues personal access tokens for those. My Vaultbooks project uses JWT with a tenant claim for that kind of reason.)

**"How do you protect routes in React?"** A layout route that checks auth state: spinner while the initial `/api/user` request is pending (so there's no flash of the login page), `<Navigate replace>` with the original URL in `state` so the user lands back where they were, `<Outlet/>` otherwise. The server is still the real gate: every API route is behind `auth:sanctum`.

**Security details worth mentioning:** session regeneration on login (session fixation), invalidate + token regeneration on logout, rate limiting per email + IP, a redirect target restricted to in-app paths (open-redirect protection), the query cache cleared on logout so the next user can't see stale data, and a 419 interceptor that refreshes the CSRF cookie and replays the request once.
