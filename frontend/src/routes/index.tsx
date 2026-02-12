/* eslint-disable react-refresh/only-export-components */
import { lazy, Suspense } from 'react';
import { createBrowserRouter, Link, Outlet } from 'react-router-dom';
import type { RouteObject } from 'react-router-dom';
import { Spinner } from 'flowbite-react';
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

// Content-only loading fallback (used inside AppLayout so header stays visible)
function AppPageFallback() {
  return (
    <div className="flex min-h-[20rem] items-center justify-center">
      <Spinner size="xl" />
    </div>
  );
}

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
        <Outlet />
      </ErrorBoundary>
    ),
    children: [
      {
        index: true,
        element: (
          <Suspense fallback={
            <div className="flex min-h-screen items-center justify-center">
              <Spinner size="xl" />
            </div>
          }>
            <HomePage />
          </Suspense>
        ),
      },
      {
        path: 'about',
        element: (
          <Suspense fallback={
            <div className="flex min-h-screen items-center justify-center">
              <Spinner size="xl" />
            </div>
          }>
            <AboutPage />
          </Suspense>
        ),
      },
      {
        element: (
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        ),
        children: [
          {
            path: 'datasets',
            element: (
              <Suspense fallback={<AppPageFallback />}>
                <DatasetsPage />
              </Suspense>
            ),
          },
          {
            path: 'entity-mappings',
            element: (
              <Suspense fallback={<AppPageFallback />}>
                <EntityMappingsPage />
              </Suspense>
            ),
          },
          {
            path: 'features',
            element: (
              <Suspense fallback={<AppPageFallback />}>
                <FeatureDefinitionsPage />
              </Suspense>
            ),
          },
          {
            path: 'analysis-jobs',
            element: (
              <Suspense fallback={<AppPageFallback />}>
                <AnalysisJobsPage />
              </Suspense>
            ),
          },
          {
            path: 'analysis-results',
            element: (
              <Suspense fallback={<AppPageFallback />}>
                <AnalysisResultsPage />
              </Suspense>
            ),
          },
        ],
      },
    ],
  },
  {
    path: '*',
    element: <NotFoundPage />,
  },
];

export const router = createBrowserRouter(routes);

