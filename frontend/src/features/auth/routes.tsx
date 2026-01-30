import type { RouteObject } from 'react-router-dom';
import { AuthLayout } from '../../layouts/auth-layout';
import { LoginPage } from './pages/login-page';
import { ErrorBoundary } from '../../components/error-boundary';

export const LOGIN_ROUTE = '/login';

export const authRoutes: RouteObject[] = [
  {
    path: LOGIN_ROUTE,
    element: (
      <ErrorBoundary>
        <AuthLayout>
          <LoginPage />
        </AuthLayout>
      </ErrorBoundary>
    ),
  },
];

