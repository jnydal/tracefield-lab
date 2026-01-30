# React Frontend Scaffold

A solid, production-ready React frontend foundation built with Vite and TypeScript. This repo is intentionally domain-agnostic so it can be used for any product or API.

## What you get

- React 18 + TypeScript + Vite
- Feature-based architecture with clear separation of concerns
- Redux Toolkit + RTK Query for state and server data
- React Router v6 with layouts and protected routes
- React Hook Form + Zod for forms and validation
- Tailwind CSS + Flowbite for UI and responsive design
- Centralized API client and generated OpenAPI types
- Error boundaries and consistent error handling

## Quick start

```bash
npm install
npm run dev
```

## Key scripts

- `npm run dev` - start the dev server
- `npm run build` - generate types and build for production
- `npm run generate:types` - generate API types from `api-openapi.json`
- `npm run lint` - run ESLint

## API configuration

Set `VITE_API_BASE_URL` to point at your backend. The default fallback is `https://api.example.com`.

The API contract lives in `api-openapi.json`, and types are generated to `src/generated/api/types.ts`.

## Project structure

```
src/
  app/        # App entry, providers, store setup
  features/   # Feature modules (feature-based)
  components/ # Reusable UI components
  services/   # API clients & RTK Query slices
  routes/     # Route composition
  layouts/    # Layout components
  styles/     # Global Tailwind + semantic classes
  assets/     # Static assets
```

## Conventions

Reference documents for architecture and UI patterns:

- `architecture.md`
- `style.md`
- `nfr.md`
- `agent.md`

## Using this scaffold

1. Update `api-openapi.json` to match your backend.
2. Run `npm run generate:types` to generate types.
3. Build features under `src/features/` and wire new endpoints under `src/services/api/`.
