import { ErrorBoundary } from '../components/error-boundary';

interface AppErrorBoundaryProps {
  children: React.ReactNode;
}

/**
 * Top-level error boundary for the entire app.
 * Wraps the router to catch any unhandled errors.
 */
export function AppErrorBoundary({ children }: AppErrorBoundaryProps) {
  return <ErrorBoundary>{children}</ErrorBoundary>;
}

