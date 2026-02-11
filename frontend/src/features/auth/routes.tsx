import type { RouteObject } from 'react-router-dom';
import { AuthLayout } from '../../layouts/auth-layout';
import { LoginPage } from './pages/login-page';
import { RegisterPage } from './pages/register-page';
import { ErrorBoundary } from '../../components/error-boundary';

export const LOGIN_ROUTE = '/login';
export const REGISTER_ROUTE = '/register';

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
  {
    path: REGISTER_ROUTE,
    element: (
      <ErrorBoundary>
        <AuthLayout>
          <RegisterPage />
        </AuthLayout>
      </ErrorBoundary>
    ),
  },
];

