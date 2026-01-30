
# Style & UI Guidelines – React Frontend Scaffold

## Design System

We use a **three-layer UI strategy**:

### 1. Flowbite Blocks (Primary – Layout & Sections)

- **Flowbite Blocks are the default starting point for all new pages and major UI sections.**
- Blocks define:
  - Page layout
  - Section structure
  - Visual composition (heroes, navigation, dashboards, forms, pricing, footers, etc.)

Rules:
- ✅ Always start with a Flowbite Block if a suitable one exists
- ✅ Use the block as the visual and structural reference
- ✅ Convert the block into React (TSX) using Tailwind classes
- ✅ Preserve Flowbite spacing, responsiveness, and layout principles unless there is a strong reason not to

Flowbite Blocks define **what the UI looks like at a high level**.

---

### 2. Flowbite React Components (Secondary – UI Primitives & Interaction)

We use **Flowbite React components as base building blocks for interactive UI elements**, such as:

- Buttons
- Modals & dialogs
- Inputs & form controls
- Tabs & accordions
- Dropdowns & tooltips
- Alerts & feedback components

Flowbite React components are used when:
- A block needs **dynamic behavior**
- A section must be **reusable**
- We need **state, validation, or interaction**

Rules:
- ✅ Use Flowbite React components inside blocks when interaction is required
- ✅ Use Flowbite React components for reusable UI primitives
- ❌ Do not rebuild standard UI elements manually if a Flowbite React component already exists

Flowbite React defines **how the UI behaves at a low level**.

---

### 3. Tailwind CSS (Layout & Fine-Tuning Layer)

We use **Tailwind CSS for utility-first styling and layout control**, including:

- Spacing
- Grid & Flexbox
- Responsive behavior
- Minor visual adjustments

Rules:
- ✅ Tailwind is used to adapt Flowbite Blocks to project needs
- ✅ Tailwind is used alongside Flowbite React components
- ❌ Tailwind must NOT be used to rebuild complex UI components that already exist in Flowbite

---

## Page Construction Rules

All step-by-step rules for creating new pages, defining semantic classes,
and applying Tailwind in TSX are defined in:

`recipes.md` (Single source of truth for page construction)

`style.md` defines the design system and constraints only.

---

## Responsive Design

The application must be fully responsive and mobile-first.  
Tailwind’s responsive utilities (sm:, md:, lg:, xl:) must be used to ensure layouts adapt correctly to phone, tablet and desktop screen sizes.

Flowbite React components should be used where possible, as they provide responsive defaults out of the box.

All new pages and components must be tested at common breakpoints:
- mobile (360–414px)
- tablet (768px)
- small desktop (1024px)
- large desktop (1280px+)

### Styling Rules

- Prefer Tailwind classes via `className`.
- Do **not** use `style={{ ... }}` inline styles except for rare dynamic cases that cannot be expressed via Tailwind.
- Global styles live in `src/styles/global.css` using Tailwind layers and **semantic component classes** (via `@apply`), not ad-hoc per-component CSS files.
:contentReference[oaicite:20]{index=20}  

## UI Decision Flow

When building UI, always follow this order:

1. **Does a Flowbite Block exist for this section?**
   - Yes → Use it
   - No → Compose using Flowbite React components

2. **Does a Flowbite React component exist for this UI element?**
   - Yes → Use it
   - No → Implement with Tailwind + custom React

---

## Component Types & Composition

### Container vs Presentational Components

- **Container components** (pages, feature-level components):
  - Live under `src/features/<featureName>/components/`.
  - Can use `useAppSelector`, `useAppDispatch`, RTK Query hooks.
  - Handle data loading, orchestration, and pass props to presentational components.

- **Presentational components**:
  - Also under `components/` (feature or global).
  - Must be **pure**, stateless where possible.
  - Receive all data and callbacks via typed props.

Composition hierarchy:

- Pages → Features → Components  
  (pages aggregate feature components; features aggregate smaller components).   

---

## Forms & Validation

- Use **React Hook Form + Zod** for all data-submitting forms:
  - Authentication flows
  - Profile editing
  - Messaging/composing content
  - Search forms that hit the backend
- Validation:
  - Perform schema validation at form level (Zod).
  - Do **not** put validation logic in Redux reducers.
- Local state (`useState`) is allowed for:
  - One-field UI controls (search inputs, simple filters).
  - Purely local, non-submitting controls.

---

## Coding Style

### General

- TypeScript everywhere for React and Redux code.
- Only function components + hooks; **no class components**.   
- Prefer **named exports** over default exports for components, hooks, and utilities.

### Naming

- Components: `PascalCase` (e.g. `UserProfileCard`).
- Custom hooks: start with `use` (e.g. `useUserProfile`).
- File names: `kebab-case` (e.g. `user-profile-card.tsx`, `user-api.service.ts`). :contentReference[oaicite:23]{index=23}  

### Formatting & Types

- ESLint + Prettier defaults:
  - 2-space indentation
  - Semicolons enabled
  - Single quotes
- Avoid `any`; prefer explicit and narrow types/interfaces.
- Use early returns and keep branching shallow.
- Comments explain **why**, not **what**.

---

## Error Handling & UX

- For backend errors:
  - Do not expose raw error messages from the server.
  - Show generic, user-friendly messages, with more detail in logs only.
- For form errors:
  - Use React Hook Form’s error messages tied to fields.
  - Provide clear labels and inline error text.

---

## Security & HTML

- Avoid `dangerouslySetInnerHTML` unless strictly necessary.
- If it must be used:
  - Sanitize input using a trusted library.
- Do not log or display raw HTML from untrusted sources.

---

## Accessibility (a11y) – UI Conventions

We rely on Flowbite’s built-in accessibility but must still ensure: :contentReference[oaicite:24]{index=24}  

- All images have meaningful `alt` text.
- Proper heading hierarchy (`h1 > h2 > h3`).
- Inputs have a label (`<label>` or `aria-label`).
- Links/buttons have descriptive text (no generic “click here”).
- Focus is managed correctly for modals/dialogs (focus trap, return focus).
- Respect `prefers-reduced-motion` for animations.

---

## Testing Style

- Use React Testing Library:
  - Test behaviour and user-visible outcomes.
  - Avoid testing implementation details.
- Test slices and selectors in isolation for Redux logic.

---

## Standard for Backend Error UI

- All backend-related errors that are shown to the user **must** be rendered using Flowbite React error components, such as:
  - `<Alert color="failure" />`
  - or equivalent Flowbite-provided error/alert components.
- Custom error `<div>` elements styled only with Tailwind **must not** be used for backend errors.
- Inline text errors are **only allowed** for field-level validation errors handled by React Hook Form + Zod.
- RTK Query errors that reach the UI layer must always be mapped to a Flowbite Alert component.
- Raw backend error messages must never be shown directly to users.

--

## Recipe: Creating a New Page (CursorAI Checklist)

When generating a new page (e.g. “Profile page”, “Settings page”), follow these steps exactly.

### Step 1 – Choose a key

- Example keys:
  - `login`, `register`, `profile`, `settings`, `matches`, `messages`
- Use this key consistently:
  - CSS classes: `.profile-page`, `.profile-card`, `.profile-form`, …
  - File names: `ProfilePage.tsx` or `profile-page.tsx` (follow existing convention).

### Step 2 – Add semantic classes to `global.css`

In `src/styles/global.css` under `@layer components`:

```css
@layer components {
  /* Profile page layout */
  .profile-page {
    @apply flex min-h-screen bg-gray-50 px-6 py-8;
  }

  .profile-card {
    @apply w-full max-w-4xl mx-auto rounded-lg border border-slate-100/80 bg-white/95 shadow-xl backdrop-blur;
  }

  .profile-card-inner {
    @apply flex flex-col gap-6 p-6 sm:p-8;
  }

  .profile-header {
    @apply flex items-center justify-between gap-4;
  }

  .profile-title {
    @apply text-2xl font-bold tracking-tight text-gray-900;
  }

  .profile-content {
    @apply grid gap-6 md:grid-cols-2;
  }

  .profile-section {
    @apply flex flex-col gap-4;
  }

  .profile-field {
    @apply flex flex-col gap-1.5;
  }

  .profile-footer {
    @apply flex justify-end gap-3 pt-4 border-t border-slate-100;
  }

  /* Profile-specific overrides of global primitives */
  .profile-page .ui-label {
    @apply text-sm font-medium text-gray-800;
  }

  .profile-page .ui-input {
    @apply shadow-sm focus:ring-2 focus:ring-blue-300 bg-white;
  }

  .profile-page .ui-button {
    @apply px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 focus:ring-4 focus:ring-blue-300;
  }
}
```

Rules:

- Use Tailwind only in @apply inside global.css.
- Think in terms of:
  - Page container (.profile-page)
  - Card/layout shell (.profile-card, .profile-card-inner)
  - Repeated patterns (fields, sections, footer)
  - Scoped overrides of ui-* primitives.

## Step 3 – Build the TSX page using semantic classes
```
export function ProfilePage() {
  return (
    <section className="profile-page">
      <div className="profile-card">
        <div className="profile-card-inner">
          <header className="profile-header">
            <h1 className="profile-title">Profil</h1>
            <Button className="ui-button">Rediger profil</Button>
          </header>

          <div className="profile-content">
            <section className="profile-section">
              <div className="profile-field">
                <Label htmlFor="displayName" className="ui-label">
                  Visningsnavn
                </Label>
                <TextInput
                  id="displayName"
                  className="ui-input"
                  /* ...form bindings... */
                />
              </div>

              <div className="profile-field">
                <Label htmlFor="bio" className="ui-label">
                  Om meg
                </Label>
                <TextInput
                  id="bio"
                  className="ui-input"
                  /* ... */
                />
              </div>
            </section>

            <section className="profile-section">
              {/* Flere felt / paneler */}
            </section>
          </div>

          <footer className="profile-footer">
            <Button color="light" className="ui-button">
              Avbryt
            </Button>
            <Button type="submit" className="ui-button">
              Lagre endringer
            </Button>
          </footer>
        </div>
      </div>
    </section>
  );
}

```

## Step 4 – Tailwind usage in TSX (strict rules)

- Allowed:
  - Simple layout wrappers: flex, grid, gap-*, mt-*, mb-*, pt-*, pb-*, w-full, max-w-*, min-h-screen
  - Very small, one-off tweaks.
- Not allowed:
  - Long Tailwind strings on Flowbite components (Button, TextInput, etc.).
  - Repeated combinations of 3+ utilities – those must be moved to global.css as named classes.

If you need a class more than once or it’s visually meaningful (“card”, “section”, “field”), define it in global.css and use that semantic name in TSX.
