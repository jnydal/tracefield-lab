# Non-Functional Requirements – React Frontend Scaffold

This document describes performance, security, testing, logging and accessibility requirements that must be respected for all implementations and refactorings.

---

## Performance

- Avoid unnecessary re-renders:
  - Keep components small and focused.
  - Use memoization (`React.memo`, `useMemo`, `useCallback`) sparingly and only when profiling indicates benefit.   
- State:
  - Keep Redux state normalized and minimal.
  - Use memoized selectors (Reselect) for derived data.
- Code splitting:
  - Lazy-load routes where appropriate using React.lazy/Suspense.
  - Avoid large bundle sizes by splitting heavy features or third-party libraries.
- Network:
  - Use RTK Query caching and invalidation effectively to avoid redundant requests.

---

## Security & Privacy

### Transport & API

- All production API calls must use **HTTPS**.
- API URLs must come from environment variables (e.g. `VITE_API_BASE_URL`), not hardcoded.   
- Frontend code must never embed secrets, credentials or tokens.

### Auth

- Auth tokens are stored in **secure httpOnly cookies**, managed by the backend API.
- Tokens must never be stored in Redux, Context or localStorage, and must not be exposed to JS.   

### Data Handling

- Avoid privacy violations:
  - Do not log personal data (PII) to console or logs.
  - Do not store PII in Redux unless absolutely required.
- Input validation:
  - All user input should go through Zod schemas when sent to the backend.
  - Never trust raw user-generated HTML or text.

### Third-Party Scripts

- Use npm packages instead of remotely loaded `<script>` tags.
- Avoid including external scripts unless explicitly approved.

---

## Logging & Error Reporting

- Use centralized logging utilities instead of raw `console.log` in production code.
- Error boundaries:
  - Wrap appropriate parts of the tree with error boundaries.
  - Show user-friendly fallback UIs on errors.
- Integrate with an error reporting service (e.g. Sentry) where configured:
  - Report unhandled exceptions and key application errors.
- Strip debug logs from production builds where possible. :contentReference[oaicite:28]{index=28}  

---

## Testing Strategy

- **Unit tests**:
  - Jest for utilities, reducers, selectors and pure logic.
- **Component tests**:
  - React Testing Library for components and hooks.
  - Focus on behaviour and rendered output, not internal implementation.   
- **End-to-end tests**:
  - Cypress.

Coverage should focus on:

- Business-critical paths (e.g. login, registration, subscription/payment, messaging).
- Core navigation and routing.
- Regression-prone areas.

---

## Accessibility

- Follow the UI accessibility rules in `style.md`.
- For new features, ensure:
  - Keyboard navigation works for all interactive elements.
  - Forms are usable with screen readers.
  - Modals, dropdowns and overlays manage focus correctly.
  - Color contrast is sufficient for text and interactive elements.

---

## Observability & Maintainability

- Code must remain readable:
  - Avoid complex, deeply nested logic.
  - Prefer smaller functions and components.
- When adding complex flows:
  - Add inline documentation (comments) explaining **why** the flow is structured as it is.
  - Add tests to protect the behaviour.
- Styling must remain maintainable:
  - Prefer centralized semantic classes in `global.css` over long, duplicated Tailwind class strings in components.
  - TSX components should mostly reference named classes (`login-page`, `profile-card`, `ui-button`, etc.) instead of raw Tailwind utilities.
  - Repeated Tailwind patterns (especially on Flowbite components) must be extracted into `@layer components` with clear, descriptive class names.
  - Inline Tailwind utilities in TSX are limited to simple layout wrappers and one-off tweaks; anything more complex must be moved to `global.css`.
- When refactoring, extract repeated Tailwind patterns into `@layer components` with clear, descriptive class names.

---

## API Reliability

- Treat the backend API (as per `api-openapi.json`) as the backend contract.
- All RTK Query API slices must be injected into the shared `baseApi` so they inherit:
  - Common error handling
  - Tagging strategy
  - Retry/backoff policy
- Error handling rules:
  - Normalize backend errors into a standard shape: `{ status, code?, message, details? }`.
  - Handle common status codes consistently:
    - 400: Map to validation or client errors; show user-friendly messages.
    - 401/403: Trigger auth-related flows (e.g. redirect to login, clear auth state) via the auth slice / AuthContext.
    - 404: Show a “not found” state at the feature or route level.
    - 500+ (server errors): Show a generic error message and log details via the logging mechanism.
  - Use RTK Query’s retry capabilities only for transient errors (e.g. network failure, 502/503), with a small, bounded retry count.
- Error boundaries:
  - Route-level and feature-level error boundaries must be used to prevent a single failing component from breaking the entire app.
  - Error boundaries must render a clear fallback and should not expose raw exception details to end users.
