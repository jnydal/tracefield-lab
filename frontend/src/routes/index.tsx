import { lazy } from 'react';
import { createBrowserRouter, Link } from 'react-router-dom';
import type { RouteObject } from 'react-router-dom';
import { authRoutes } from '../features/auth/routes';
import { ProtectedRoute } from './protected-route';
import { ErrorBoundary } from '../components/error-boundary';

// Export ProtectedRoute for use in feature routes
export { ProtectedRoute };

// Lazy-load heavier routes to keep initial bundle lean
// For now, Home is simple, but this pattern is ready for future routes
const HomePage = lazy(() =>
  Promise.resolve({
    default: () => <div>Home (placeholder)</div>,
  })
);

// 404 Page component
function NotFoundPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">404</h1>
        <p className="text-lg mb-4">Siden du leter etter ble ikke funnet.</p>
        <Link to="/" className="text-blue-600 hover:underline">
          Gå til forsiden
        </Link>
      </div>
    </div>
  );
}

const routes: RouteObject[] = [
  ...authRoutes,
  {
    path: '/',
    element: (
      <ErrorBoundary>
        <HomePage />
      </ErrorBoundary>
    ),
  },
  {
    path: '*',
    element: <NotFoundPage />,
  },
];

export const router = createBrowserRouter(routes);

