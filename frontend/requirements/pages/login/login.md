# Page Spec -- Login
> This document describes the behaviour and UI of the **Login**
> page.\
> Cursor: follow this spec together with `agent.md`, `architecture.md`,
> `style.md` and `nfr.md`.

------------------------------------------------------------------------

## 1. Purpose

The Login page lets an existing user authenticate with their
**email/username + password** and gain access to the authenticated area
of the app.

It should:

-   Be consistent with the visual design from `login.png`.
-   Use the shared **Auth** mechanisms (Redux / RTK Query / AuthLayout).
-   Provide clear, non-intrusive validation and error feedback.

------------------------------------------------------------------------

## 2. Route & Placement

-   **Route path:** `/login`

-   **Layout:** use `AuthLayout` from `src/layouts/AuthLayout.tsx`.

-   **Feature folder:** implement the page under:

        src/features/auth/
          components/
          pages/
            LoginPage.tsx
          hooks/
          routes.tsx

------------------------------------------------------------------------

## 3. Endpoint

-   Path: `POST /user/login` (operationId: `auth_login`).

-   The OpenAPI spec currently does **not** define a detailed
    requestBody/response schema for this endpoint -- only a generic
    `object`.

-   The agent must:

    -   Either reuse the exact payload shape from the existing legacy
        frontend/backend docs, or
    -   Follow an explicit override specified in a prompt.

-   **Temporary working assumption** (until backend confirms shape):

    ``` ts
    { username: string; password: string }
    ```

    or (alternative backend format):

    ``` ts
    { email: string; password: string }
    ```

-   All validation schemas and TypeScript types must be local and easily
    replaceable.

------------------------------------------------------------------------

## 4. User Flows

### 4.1 Happy Path

1.  User opens `/login`.
2.  Enters identifier (email or username) + password.
3.  Clicks **Logg inn**.
4.  Form validates required fields.
5.  RTK Query `auth_login` mutation runs (`POST /user/login`).
6.  On success:
    -   Auth slice updates with returned user/session.
    -   User is redirected to:
        -   a stored "returnTo" route if present, **or**
        -   the default authenticated route (e.g., `/`).

------------------------------------------------------------------------

### 4.2 Empty Fields Flow

1.  User clicks **Logg inn** with empty fields.
2.  Inline error messages appear under **each empty field**.
3.  Focus moves to the first invalid field.

------------------------------------------------------------------------

### 4.3 Incorrect Credentials Flow

1.  User enters both fields correctly but backend responds `401`
    (invalid credentials).
2.  A **general error message** appears under the button or at the top
    of the form.
3.  Values in the fields remain unchanged.
4.  User may retry without losing input.

------------------------------------------------------------------------

## 5. UI Layout & Content

Use Tailwind + Flowbite React components according to `style.md`.

### 5.1 Structure

-   A centered card on desktop.
-   Background image visible behind the card.
-   On mobile:
    -   Card fills horizontal space with padding.
    -   Background image may be hidden or repositioned depending on
        `AuthLayout`.
-   **No global header** is shown on the login page (logged-out state).

### 5.2 Elements

-   **Heading:** `Logg inn` (`<h1>`).
-   **Inputs:**
    -   Identifier (label `E-post eller brukernavn`, name `identifier`,
        type `text`).
    -   Password (label `Passord`, name `password`, type `password`).
-   **Actions:**
    -   Primary button: `Logg inn` (full-width on mobile).
    -   Text links:
        -   `Glemt passord?` → `/forgot-password`
        -   `Ny bruker? Opprett gratis profil` → `/register`
-   **No helper text** under inputs; keep UI clean.

### 5.3 Loading State

-   When request is running:
    -   Button disabled.
    -   Loading spinner shown (Flowbite loading button style).

------------------------------------------------------------------------

## 6. Validation

Use **React Hook Form + Zod**.

### 6.1 Rules

-   `identifier`: required, non-empty string.
-   `password`: required, non-empty string.

### 6.2 Behaviour

-   **No validation on blur.**
-   Validate on submit.
-   Inline error messages under fields.
-   Focus moves to first invalid field.

------------------------------------------------------------------------

## 7. Error States

### 7.1 Client-side Validation Errors

-   Message: `Feltet kan ikke være tomt`.
-   Displayed under each invalid field.
-   Inputs show Flowbite error styling.

------------------------------------------------------------------------

### 7.2 Incorrect Credentials (401)

-   General message:\
    `E-post/brukernavn eller passord er feil. Vennligst prøv igjen.`
-   Displayed near top of form or under submit button.
-   Fields are **not cleared**.
-   Inputs do **not** switch to error state unless missing data.

------------------------------------------------------------------------

### 7.3 Server Errors (5xx / Network)

-   Generic message:\
    `Noe gikk galt ved innlogging. Vennligst prøv igjen senere.`
-   Log error internally according to `nfr.md`.

------------------------------------------------------------------------

## 8. API Integration

### 8.1 RTK Query

Implement login via RTK Query in the main API slice, following
`architecture.md`:

-   Mutation: `login`
-   Endpoint: `POST /user/login`
-   OperationId: `auth_login`

------------------------------------------------------------------------

## 9. Logged-in Header (Context)

-   A **responsive header** (nav menu + user icon) is rendered only after
    login on authenticated pages.
-   Logged-out routes (including `/login`) do **not** render the header.

### 8.2 Response Handling

-   **Success:** store user/session in `authSlice`, then redirect.
-   **401:** trigger incorrect-credentials state.
-   **Other errors:** show generic error message.

------------------------------------------------------------------------

## 9. Navigation

-   After login:
    -   Redirect to intended protected route if defined.
    -   Else go to default authenticated route (e.g., `/`).
-   Links from this page:
    -   `/forgot-password`
    -   `/register`

------------------------------------------------------------------------

## 10. Accessibility

-   Use semantic HTML elements.
-   `<label>` linked with `htmlFor` for each input.
-   Error messages use `aria-describedby`.
-   General error uses `role="alert"`.
-   On first load, focus identifier field.
-   On validation failure, focus first invalid field.
-   Full keyboard navigation must work.

------------------------------------------------------------------------

## 11. Acceptance Criteria

A feature is complete when:

### Functional

-   Login page renders correctly at `/login`.
-   Validation triggers only on submit.
-   Empty fields show inline errors.
-   Incorrect credentials show global error.
-   Successful login redirects and stores user.
-   Button shows loading state during request.

### Technical

-   Uses RTK Query + Zod + React Hook Form.
-   Follows folder structure in section 2.
-   Uses Flowbite React components where appropriate.
-   No inline styles; all styling through Tailwind.

### Accessibility

-   Labels, aria attributes, and focus handling implemented.
