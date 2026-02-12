/* eslint-disable react-refresh/only-export-components */
import { lazy } from 'react';
import { createBrowserRouter, Link } from 'react-router-dom';
import type { RouteObject } from 'react-router-dom';
import { authRoutes } from '../features/auth/routes';
import { ProtectedRoute } from './protected-route';
import { ErrorBoundary } from '../components/error-boundary';
import { AppLayout } from '../layouts/app-layout';

// Export ProtectedRoute for use in feature routes
export { ProtectedRoute };

// Lazy-load heavier routes to keep initial bundle lean
const HomePage = lazy(() =>
  import('../features/public/pages/landing-page').then((module) => ({
    default: module.LandingPage,
  }))
);
const AboutPage = lazy(() =>
  import('../features/public/pages/about-page').then((module) => ({
    default: module.AboutPage,
  }))
);

const DatasetsPage = lazy(() =>
  import('../features/pipeline/pages/datasets-page').then((module) => ({
    default: module.DatasetsPage,
  }))
);
const EntityMappingsPage = lazy(() =>
  import('../features/pipeline/pages/entity-mappings-page').then((module) => ({
    default: module.EntityMappingsPage,
  }))
);
const FeatureDefinitionsPage = lazy(() =>
  import('../features/pipeline/pages/feature-definitions-page').then((module) => ({
    default: module.FeatureDefinitionsPage,
  }))
);
const AnalysisJobsPage = lazy(() =>
  import('../features/pipeline/pages/analysis-jobs-page').then((module) => ({
    default: module.AnalysisJobsPage,
  }))
);
const AnalysisResultsPage = lazy(() =>
  import('../features/pipeline/pages/analysis-results-page').then((module) => ({
    default: module.AnalysisResultsPage,
  }))
);

// 404 Page component
function NotFoundPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">404</h1>
        <p className="text-lg mb-4">Siden du leter etter ble ikke funnet.</p>
        <Link to="/" className="text-violet-600 hover:underline">
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
    path: '/about',
    element: (
      <ErrorBoundary>
        <AboutPage />
      </ErrorBoundary>
    ),
  },
  {
    path: '/datasets',
    element: (
      <ErrorBoundary>
        <ProtectedRoute>
          <AppLayout>
            <DatasetsPage />
          </AppLayout>
        </ProtectedRoute>
      </ErrorBoundary>
    ),
  },
  {
    path: '/entity-mappings',
    element: (
      <ErrorBoundary>
        <ProtectedRoute>
          <AppLayout>
            <EntityMappingsPage />
          </AppLayout>
        </ProtectedRoute>
      </ErrorBoundary>
    ),
  },
  {
    path: '/features',
    element: (
      <ErrorBoundary>
        <ProtectedRoute>
          <AppLayout>
            <FeatureDefinitionsPage />
          </AppLayout>
        </ProtectedRoute>
      </ErrorBoundary>
    ),
  },
  {
    path: '/analysis-jobs',
    element: (
      <ErrorBoundary>
        <ProtectedRoute>
          <AppLayout>
            <AnalysisJobsPage />
          </AppLayout>
        </ProtectedRoute>
      </ErrorBoundary>
    ),
  },
  {
    path: '/analysis-results',
    element: (
      <ErrorBoundary>
        <ProtectedRoute>
          <AppLayout>
            <AnalysisResultsPage />
          </AppLayout>
        </ProtectedRoute>
      </ErrorBoundary>
    ),
  },
  {
    path: '*',
    element: <NotFoundPage />,
  },
];

export const router = createBrowserRouter(routes);

