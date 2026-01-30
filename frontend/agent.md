# Agent Spec – React Frontend Scaffold

## Purpose

You are maintaining and extending a new React frontend scaffold for a generic product.  
The frontend communicates **only** with the backend API using JSON-based HTTP endpoints defined in `api-openapi.json`. :contentReference[oaicite:1]{index=1}

Your job is to:

- Implement new pages, flows and components based on sketches, wireframes and process descriptions.
- Keep the architecture, folder structure and coding style **consistent** over time.
- Use the **existing patterns** in this repo and the rules in `architecture.md`, `style.md` and `nfr.md` as your source of truth.

If there is any conflict between:
1. Existing code
2. `agent.md`
3. `architecture.md`, `style.md`, `nfr.md`

…then **prefer existing code patterns**, but otherwise follow `agent.md` first, then `architecture.md`, then `style.md` and `nfr.md`.

---

## Tech Stack

Always assume and use this stack:

- **Build**: Vite
- **UI**: React 18, function components + hooks
- **Language**: TypeScript
- **State**: Redux Toolkit + RTK Query
- **Routing**: React Router v6 (nested routes)
- **Forms**: React Hook Form + Zod
- **Styling**: Tailwind CSS + Flowbite React components
- **Testing**: Jest, React Testing Library, Cypress   

### Styling Strategy

The styling stack is:

- Tailwind CSS
- Flowbite Blocks (for page/section layout)
- Flowbite React components (for interactive primitives)
- **Semantic component classes defined in `src/styles/global.css` using `@apply`**

---

## Backend / API

- Backend is the **project API**, described by `api-openapi.json`.  
- Base URL (prod): `https://api.example.com`. :contentReference[oaicite:3]{index=3}  
- The OpenAPI spec defines endpoints for domains such as `auth`, `user`, `matchSearch`, `blog`, `forum`, `chat`, `events`, `product`, etc.   

**Rules:**

1. Do **not** call `fetch` or `axios` directly in components.
2. All HTTP must go through:
   - `src/services/api-client.ts`, and
   - RTK Query APIs in `src/services/api/`, or
   - Thunks that also use the shared `apiClient`. :contentReference[oaicite:5]{index=5}  
3. When you need a new backend interaction, locate the endpoint in `api-openapi.json` and:
   - Add/extend an RTK Query slice in `src/services/api/…`
   - Create/adjust TypeScript types and Zod schemas as needed.
4. Treat OpenAPI response schemas as **authoritative** where they exist; otherwise define local types that match the current backend behaviour.

### Base API & Types

- All RTK Query API slices must be created by **injecting into a shared `baseApi`** defined in `src/services/api/base-api.ts`.
- `baseApi` is responsible for:
  - Attaching the correct base URL and headers
  - Normalizing error shapes into a standard `{ status, code?, message, details? }` structure
  - Handling auth-related status codes (401/403) by delegating to the auth slice / AuthContext
  - Defining shared `tagTypes` for cache invalidation (e.g. `Auth`, `Profile`, `Messages`, `Search`, `Subscriptions`).
- Do **not** create standalone `createApi` instances per feature; always inject endpoints into `baseApi`.

### Generated API Types

- All request/response types for backend endpoints are generated from `api-openapi.json` into `src/generated/api/`.
- When working with backend data:
  - Prefer the generated types as the **source of truth**.
  - Only add local wrapper types when composing multiple responses or adding view-model fields (e.g. UI-only flags).
- Do **not** hand-write request/response shapes that duplicate the OpenAPI contract.

---

## High-Level Architecture Rules

You **must** follow the architecture described in `architecture.md`. In short:   

- Use a **feature-based** structure under `src/features/`.
- Global/shared stuff lives in:
  - `src/components/` (reusable UI)
  - `src/services/` (HTTP and API)
  - `src/hooks/` (reusable hooks)
  - `src/routes/` (top-level route config)
  - `src/layouts/` (layouts)
  - `src/styles/` (global CSS)
  - `src/utils/` (small pure helpers)
- Global state (auth, profile, lists, settings, cached data) lives in Redux.
- Local, ephemeral UI state lives in component `useState`/`useReducer`.

---

## How to Implement a New Feature / Page

When you get a new sketch / wireframe / flow, follow this checklist:

1. **Create / extend feature folder**

   - Under `src/features/<featureName>/`:
     - `components/` – presentational + container components
     - `redux/` – slice, thunks, selectors
     - `hooks/` – feature-specific hooks
     - `types/` – TS interfaces & types
     - (optional) `urlState.ts` or other helpers for query params, etc.   

2. **Wire backend**

   - Find or add the relevant endpoint in `src/services/api/<domain>.ts` using RTK Query.
   - Use `apiClient` as the base for RTK Query’s `baseQuery`.
   - Expose typed hooks (`useGetXQuery`, `useUpdateXMutation`, etc.)

3. **Add routes**

   - Define feature-specific routes in `src/features/<featureName>/routes.tsx`.
   - Use semantic URLs and constants (e.g. `export const PROFILE_ROUTE = "/profile";`).
   - Register them in `src/routes/index.tsx` and use the correct layout (`MainLayout`, `AuthLayout`, `PublicLayout`). :contentReference[oaicite:8]{index=8}  

4. **Implement UI**

   - Use Flowbite Blocks as default starting point, and fallback to Flowbite React components and Tailwind classes when neccesarry.
   - Container components:
     - Use RTK Query hooks and/or `useAppSelector` / `useAppDispatch`.
   - Presentational components:
     - Receive data and callbacks via props only; no direct store access.

5. **Forms & validation**

   - Use React Hook Form + Zod for all forms that submit to the backend.
   - Local state is allowed for simple one-field controls that don’t go to the backend.

6. **State & communication**

   - Parent → child: props.
   - Child → parent: typed callback props.
   - Sibling ↔ sibling: shared parent state or Redux; never direct coupling. :contentReference[oaicite:9]{index=9}  

7. **Tests**

   - Add or extend Jest/RTL tests for reducers, selectors and important components.
   - Add/extend E2E tests for critical flows (e.g. login, profile update, match search) when needed.

---


## Backend API Specification
The backend API is fully defined in the file `api-openapi.json`.  
The agent must always refer to this OpenAPI specification when generating:
- RTK Query endpoints
- Request/response TypeScript types
- Error handling tied to status codes
- API integration logic
- Form contracts for backend-driven validation

Never guess API shapes. Always read from the OpenAPI spec unless the user explicitly overrides it in a prompt.


---

## Agent Behaviour Rules

When generating or editing code:

1. **Always respect the folder structure and layering** from `architecture.md`.
2. **Always use TypeScript** and typed hooks (`useAppSelector`, `useAppDispatch`, custom hooks prefixed with `use`).
3. **Never** call `fetch`, `axios` or `apiClient` directly from components; use RTK Query or thunks instead. :contentReference[oaicite:10]{index=10}  
4. Use **small, composable components** over monolithic ones.
5. Favor **clarity over cleverness**; keep branching shallow and use early returns.
6. Add comments only to explain **why**, not **what**.
7. When you are unsure between multiple valid options, **prefer consistency** with existing code and these docs.
8. When importing TypeScript-only types from any library (including `@reduxjs/toolkit` and `@reduxjs/toolkit/query`), you must always use `import type`. Type-only exports must never be imported as runtime values.
  - Example:
  ```ts
  import { createSlice } from '@reduxjs/toolkit';
  import type { PayloadAction } from '@reduxjs/toolkit';

  import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
  import type { BaseQueryFn } from '@reduxjs/toolkit/query';
  ```
9. For any page or route that requires authentication, always use the shared **Protected Route** / auth guard component (e.g. `ProtectedRoute` in `src/routes/`), instead of implementing ad-hoc auth checks in page components.
10. When adding new route groups, ensure they are covered by an **error boundary** (e.g. `AppErrorBoundary` or feature-level error boundary) so that unexpected errors render a user-friendly fallback instead of breaking the whole app.
11. All RTK Query API slices must be built by **injecting into the shared `baseApi`**, inheriting its error handling, retry policy and tagging strategy.
12. Generated API types from `src/generated/api/` are the authoritative source for backend contracts. Do not “guess” shapes or duplicate them manually unless the user explicitly overrides them in a prompt.

