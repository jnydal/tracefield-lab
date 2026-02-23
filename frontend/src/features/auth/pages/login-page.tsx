import { useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Alert, Button, FloatingLabel, Spinner } from 'flowbite-react';
import { useLoginMutation } from '../../../services/api/auth-api';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { selectIsAuthenticated, setUser } from '../redux/auth-slice';
import { loginSchema, type LoginFormData } from '../types/login-schema';

export function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const dispatch = useAppDispatch();
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const isAuthLoading = useAppSelector((state) => state.auth.isLoading);
  const [login, { isLoading }] = useLoginMutation();
  const errorAlertRef = useRef<HTMLDivElement>(null);
  const apiBaseUrl = (() => {
    const rawBase = import.meta.env.VITE_API_BASE_URL;
    if (!rawBase) {
      return 'http://localhost:8000';
    }

    // Allow relative base URLs like "/api" or "api"
    if (rawBase.startsWith('/')) {
      return new URL(rawBase, window.location.origin).toString();
    }

    if (!rawBase.startsWith('http://') && !rawBase.startsWith('https://')) {
      return new URL(`/${rawBase}`, window.location.origin).toString();
    }

    return rawBase;
  })();

  const {
    register,
    handleSubmit,
    formState: { errors },
    setFocus,
    setError,
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    mode: 'onSubmit',
    reValidateMode: 'onSubmit',
  });

  // Focus identifier field on mount
  useEffect(() => {
    setFocus('identifier');
  }, [setFocus]);

  // Focus first error field on validation error
  useEffect(() => {
    if (errors.identifier) {
      setFocus('identifier');
    } else if (errors.password) {
      setFocus('password');
    }
  }, [errors, setFocus]);

  useEffect(() => {
    if (errors.root) {
      errorAlertRef.current?.focus();
    }
  }, [errors.root]);

  useEffect(() => {
    if (isAuthLoading) return;
    if (isAuthenticated) {
      const returnTo = searchParams.get('returnTo') || '/datasets';
      navigate(returnTo, { replace: true });
    }
  }, [isAuthLoading, isAuthenticated, navigate, searchParams]);

  const onSubmit = async (data: LoginFormData) => {
    try {
      const result = await login({
        identifier: data.identifier,
        password: data.password,
      }).unwrap();

      // Update auth state
      // Since OpenAPI doesn't define exact shape, we extract user flexibly
      const responseData = result as Record<string, unknown>;
      const userData = (responseData.user ?? responseData) as Record<string, unknown>;
      const user = {
        id: typeof userData.id === 'string' ? userData.id : 'unknown',
        username: typeof userData.username === 'string' 
          ? userData.username 
          : data.identifier,
        email: typeof userData.email === 'string' ? userData.email : undefined,
        displayName: typeof userData.displayName === 'string' 
          ? userData.displayName 
          : undefined,
        ...userData,
      };
      dispatch(setUser(user));

      // Redirect to returnTo or default route
      const returnTo = searchParams.get('returnTo') || '/datasets';
      navigate(returnTo, { replace: true });
    } catch (error) {
      // Error is now normalized to ApiErrorShape { status, code?, message, details? }
      const status =
        error && typeof error === 'object' && 'status' in error
          ? (error as { status?: number }).status ?? 0
          : 0;

      const message =
        status === 401
          ? 'E-post/brukernavn eller passord er feil. Vennligst prøv igjen.'
          : (error && typeof error === 'object' && 'message' in error
              ? (error as { message?: string }).message
              : 'Noe gikk galt ved innlogging. Vennligst prøv igjen senere.') || 
            'Noe gikk galt ved innlogging. Vennligst prøv igjen senere.';

      setError('root', {
        type: 'server',
        message,
      });
    }
  };

  const handleGoogleLogin = () => {
    const returnTo = searchParams.get('returnTo') || '/datasets';
    const baseWithSlash = apiBaseUrl.endsWith('/') ? apiBaseUrl : `${apiBaseUrl}/`;
    const authUrl = new URL('auth/google/start', baseWithSlash);
    authUrl.searchParams.set('returnTo', returnTo);
    window.location.assign(authUrl.toString());
  };

  return (
    <section className="login-page">
      <div className="login-container">
        <div className="login-card">
          <div className="login-card-inner">
            <h1 className="login-title">Tracefield Lab</h1>
            <h2 className="login-subtitle">Logg inn</h2>

            <div className="login-sso">
              <button
                type="button"
                className="login-sso-button"
                onClick={handleGoogleLogin}
              >
                <svg
                  className="login-sso-icon"
                  viewBox="0 0 24 24"
                  width="20"
                  height="20"
                  aria-hidden="true"
                >
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Fortsett med Google
              </button>
              <div className="login-divider" role="separator" aria-label="Eller">
                <span>eller</span>
              </div>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} noValidate className="login-form">
              {errors.root && (
                <Alert
                  ref={errorAlertRef}
                  color="failure"
                  tabIndex={-1}
                  aria-live="assertive"
                  role="alert"
                  className="login-error"
                >
                  {errors.root.message}
                </Alert>
              )}

              <div className="login-field">
                <FloatingLabel
                  variant="outlined"
                  id="identifier"
                  label="E-post eller brukernavn"
                  type="text"
                  autoComplete="username"
                  {...register('identifier')}
                  color={errors.identifier ? 'error' : undefined}
                  aria-describedby={errors.identifier ? 'identifier-error' : undefined}
                  aria-invalid={!!errors.identifier}
                  required
                />
                {errors.identifier && (
                  <p id="identifier-error" className="auth-field-error">
                    {errors.identifier.message}
                  </p>
                )}
              </div>

              <div className="login-field">
                <FloatingLabel
                  variant="outlined"
                  id="password"
                  label="Passord"
                  type="password"
                  autoComplete="current-password"
                  {...register('password')}
                  color={errors.password ? 'error' : undefined}
                  aria-describedby={errors.password ? 'password-error' : undefined}
                  aria-invalid={!!errors.password}
                  required
                />
                {errors.password && (
                  <p id="password-error" className="auth-field-error">
                    {errors.password.message}
                  </p>
                )}
              </div>

              <Button type="submit" disabled={isLoading} className="ui-button">
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Spinner size="sm" />
                    Logger inn...
                  </span>
                ) : (
                  'Logg inn'
                )}
              </Button>
            </form>

            <div className="login-links">
              <div>
                <Link
                  to="/forgot-password"
                  className="login-link"
                >
                  Glemt passord?
                </Link>
              </div>
              <div>
                <Link to="/register" className="login-link">
                  Ny bruker? Opprett gratis profil
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

