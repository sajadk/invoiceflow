# Milestone 1 — React concepts, explained for a Vue developer

## Files to read, in order

1. `web/src/main.tsx` — app bootstrap
2. `web/src/router.tsx` — routes
3. `web/src/components/layout/AppLayout.tsx` — layout with nested routes
4. `web/src/features/health/` — the full data flow: `api.ts` → `useHealth.ts` → `HealthStatusCard.tsx`

## Vue → React cheat sheet (what this milestone uses)

| Vue 3 | React | Where in the code |
|---|---|---|
| `createApp(App).use(router).mount('#app')` | `createRoot(el).render(<Providers><App/></Providers>)` | `main.tsx` |
| `app.use(plugin)` / `provide()` | Wrap the tree in a Provider component (`QueryClientProvider`) | `main.tsx` |
| Single-file component (`<template>` + `<script setup>`) | A function that returns JSX. No template; markup *is* JavaScript | every `.tsx` |
| `v-if` / `v-else` | Ternary `cond ? <A/> : <B/>` or `cond && <A/>` | `HealthStatusCard.tsx` |
| `v-for="item in items" :key` | `items.map(item => <Li key={item.id} />)` | `AppLayout.tsx` |
| `:class="{ active: isActive }"` | `className={isActive ? '…' : '…'}` (template string) | `AppLayout.tsx` |
| `@click="refetch"` | `onClick={() => refetch()}` | `HealthStatusCard.tsx` |
| `defineProps<{ label: string }>()` | Function parameters: `function Row({ label }: { label: string })` | `StatusRow` |
| `<router-view />` | `<Outlet />` | `AppLayout.tsx` |
| `<router-link>` with `active-class` | `<NavLink className={({ isActive }) => …}>` | `AppLayout.tsx` |
| Composable (`useSomething()`) | Custom hook (`useHealth()`): same idea, name must start with `use` | `useHealth.ts` |
| Pinia store / `ref` + `onMounted(fetch)` for server data | TanStack Query `useQuery`: caching, refetching, loading/error state for free | `useHealth.ts` |

## The big mental shift

**Vue is reactive; React re-renders.** In Vue, you mutate a `ref` and Vue tracks exactly what depends on it. In React, a component is just a function. When its state or props change, React calls the function again and diffs the JSX it returns. Consequences you'll meet soon:

- State is immutable. You don't do `items.value.push(x)`; you do `setItems([...items, x])`.
- Anything computed inside the component body is recalculated on every render (that's how React does `computed` — usually it's fine; `useMemo` is the escape hatch).
- Hooks must be called in the same order every render: never inside `if`s or loops.

We've avoided `useState`/`useEffect` on purpose so far. TanStack Query replaces the classic `useEffect(() => fetch…, [])` pattern, which is what most teams use now. Milestone 2 introduces `useState`, `useContext` and form handling for the login page.

## Interview talking points from this milestone

- **Why a Vite proxy?** It keeps the API same-origin in development, so Sanctum cookie auth works without CORS or SameSite issues, and production mirrors it with CloudFront path routing.
- **Why TanStack Query instead of Redux/Zustand for API data?** Server state (cached copies of backend data) and client state (UI toggles) are different problems. Query handles caching, deduping, background refetch and invalidation; a global store is only needed for genuinely client-side state.
- **Feature folders** (`features/health/`) scale better than type folders (`components/`, `hooks/`, `services/`) because everything for one domain changes together.
