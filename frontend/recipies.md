## When Creating a New Page or Flow

When the user asks for a new page/flow (e.g. “create a login page”, “build a profile settings page”), always follow this pattern:

0. **Decide if the page is protected**

   - If the page/flow requires an authenticated user (e.g. profile, matches, messages, subscriptions, account settings):
     - Ensure the route is wrapped using the shared auth guard (e.g. `ProtectedRoute`) in `src/routes/`.
   - Public pages (landing, login, registration, forgot password, marketing content) must *not* use the auth guard.
   - Do not duplicate auth checks inside the page component; the guard is responsible for redirecting unauthenticated users.

1. **Pick a page key**

   - Derive a short key from the feature:
     - `login`, `register`, `profile`, `settings`, `matches`, etc.
   - Use that key consistently for both CSS and TSX.

2. **Update `global.css` first**

   Under `@layer components` in `src/styles/global.css`, always create:

   - A page-level class:  
     - `.{{key}}-page`
   - Common structural classes:  
     - `.{{key}}-card`, `.{{key}}-header`, `.{{key}}-content`, `.{{key}}-form`, `.{{key}}-field`, `.{{key}}-footer` as needed.
   - Context-specific overrides of global primitives:  
     - `.{{key}}-page .ui-label`, `.{{key}}-page .ui-input`, `.{{key}}-page .ui-button`, etc.

   Use `@apply` with Tailwind utilities **only in `global.css`**, not inline in TSX, except for very small layout tweaks.

3. **Then create the TSX page**

   - The root element must use the page class:  
     - `<section className="{{key}}-page">`
   - Inside, use the semantic classes defined in `global.css`:  
     - `<div className="{{key}}-card">`, `<form className="{{key}}-form">`, `<div className="{{key}}-field">`…
   - Use Flowbite React components for inputs/buttons and style them via **semantic classes only**:
     - `<Label className="ui-label" />`
     - `<TextInput className="ui-input" />`
     - `<Button className="ui-button" />`

4. **Avoid Tailwind soup in TSX**

   - TSX `className` should be **short semantic names**, not long Tailwind lists.
   - Inline Tailwind is allowed only for:
     - Simple layout wrappers (`flex`, `grid`, `gap-*`, `mt-*`, `mb-*`, `w-full`, `max-w-*`, `min-h-screen`, etc.).
     - One-off tweaks that are not expected to be reused.
   - If you need more than **3–4 Tailwind utilities on an element**, go back and define a named class in `global.css` instead.

5. **Prefer reusing existing primitives**

   - Before inventing new classes, look for existing ones in `global.css`:
     - Reuse `.ui-label`, `.ui-input`, `.ui-button`, `.ui-link`, etc.
   - Only create new classes if:
     - The visual pattern is specific to this page **and**
     - It’s used more than once on that page.

### Rules:

- New UI should NOT be built with long inline Tailwind class strings in TSX.
- Instead, define **semantic, reusable CSS classes** in `global.css` under `@layer components` and use those class names in components.
- Tailwind utility classes may still be used inline for:
  - Simple layout wrappers (`flex`, `grid`, `gap-*`, `mt-*`, etc.)
  - One-off tweaks that are unlikely to be reused.

Example (login page):

- Global styles in `global.css`:

  ```css
  @layer components {
    .login-page {
      @apply flex min-h-screen items-center justify-center bg-gray-50 px-6 py-8;
    }

    .login-card {
      @apply rounded-lg border border-slate-100/80 bg-white/95 shadow-xl backdrop-blur sm:border-slate-200;
    }

    .login-card-inner {
      @apply flex flex-col gap-8 p-6 sm:p-8;
    }

    .login-title {
      @apply text-2xl font-bold tracking-tight text-gray-900 text-center;
    }

    .login-form {
      @apply flex flex-col gap-5;
    }

    .login-field {
      @apply flex flex-col gap-1.5;
    }

    .login-error {
      @apply text-sm;
    }

    .login-links {
      @apply flex flex-col gap-2 text-center text-sm text-gray-700;
    }

    .login-link {
      @apply text-blue-600 hover:text-blue-800 hover:underline;
    }

    .login-page .ui-label {
      @apply text-sm font-medium text-gray-800 dark:text-gray-200;
    }

    .login-page .ui-input {
      @apply shadow-sm focus:ring-2 focus:ring-blue-300 dark:focus:ring-blue-500 bg-white dark:bg-slate-800;
    }

    .login-page .ui-button {
      @apply w-full bg-blue-600 text-white hover:bg-blue-700 focus:ring-4 focus:ring-blue-300 dark:focus:ring-blue-600;
    }
  }

- Component code: ```
export function LoginPage() {
  return (
    <section className="login-page">
      <div className="w-full max-w-md">
        <div className="login-card">
          <div className="login-card-inner">
            <h1 className="login-title">Logg inn</h1>
            <form className="login-form">
              {/* ... */}
            </form>
            <div className="login-links">
              <a className="login-link">Glemt passord?</a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
```