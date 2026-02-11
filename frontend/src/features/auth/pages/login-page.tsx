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
      const returnTo = searchParams.get('returnTo') || '/';
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
            <h1 className="login-title">Logg inn</h1>

            <div className="login-sso">
              <button
                type="button"
                className="login-sso-button"
                onClick={handleGoogleLogin}
              >
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

