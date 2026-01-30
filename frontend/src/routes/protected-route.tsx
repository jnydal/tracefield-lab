import { Navigate, useLocation } from 'react-router-dom';
import { useAppSelector } from '../app/hooks';
import { selectIsAuthenticated } from '../features/auth/redux/auth-slice';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

/**
 * ProtectedRoute guard component that redirects unauthenticated users to login.
 * Preserves the original location so users can be redirected back after login.
 */
export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const location = useLocation();

  if (!isAuthenticated) {
    // Redirect to login with returnTo parameter
    const returnTo = encodeURIComponent(
      location.pathname + location.search
    );
    return <Navigate to={`/login?returnTo=${returnTo}`} replace />;
  }

  return <>{children}</>;
}

