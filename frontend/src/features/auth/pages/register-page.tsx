import { useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Alert, Button, FloatingLabel, Spinner } from 'flowbite-react';
import { useRegisterMutation } from '../../../services/api/auth-api';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { selectIsAuthenticated, setUser } from '../redux/auth-slice';
import { registerSchema, type RegisterFormData } from '../types/register-schema';

export function RegisterPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const dispatch = useAppDispatch();
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const isAuthLoading = useAppSelector((state) => state.auth.isLoading);
  const [registerUser, { isLoading }] = useRegisterMutation();
  const errorAlertRef = useRef<HTMLDivElement>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setFocus,
    setError,
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    mode: 'onSubmit',
    reValidateMode: 'onSubmit',
  });

  useEffect(() => {
    setFocus('email');
  }, [setFocus]);

  useEffect(() => {
    if (errors.email) {
      setFocus('email');
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

  const onSubmit = async (data: RegisterFormData) => {
    try {
      const result = await registerUser({
        email: data.email,
        password: data.password,
      }).unwrap();

      const responseData = result as Record<string, unknown>;
      const userData = (responseData.user ?? responseData) as Record<string, unknown>;
      const user = {
        id: typeof userData.id === 'string' ? userData.id : 'unknown',
        username: typeof userData.username === 'string' ? userData.username : data.email,
        email: typeof userData.email === 'string' ? userData.email : data.email,
        displayName: typeof userData.displayName === 'string' ? userData.displayName : undefined,
        ...userData,
      };
      dispatch(setUser(user));

      const returnTo = searchParams.get('returnTo') || '/';
      navigate(returnTo, { replace: true });
    } catch (error) {
      const status =
        error && typeof error === 'object' && 'status' in error
          ? (error as { status?: number }).status ?? 0
          : 0;
      const message =
        status === 409
          ? 'E-post er allerede i bruk. Vennligst velg en annen.'
          : (error && typeof error === 'object' && 'message' in error
              ? (error as { message?: string }).message
              : 'Noe gikk galt ved registrering. Vennligst prøv igjen senere.') ||
            'Noe gikk galt ved registrering. Vennligst prøv igjen senere.';

      setError('root', {
        type: 'server',
        message,
      });
    }
  };

  return (
    <section className="register-page">
      <div className="register-container">
        <div className="register-card">
          <div className="register-card-inner">
            <h1 className="register-title">Opprett konto</h1>

            <form onSubmit={handleSubmit(onSubmit)} noValidate className="register-form">
              {errors.root && (
                <Alert
                  ref={errorAlertRef}
                  color="failure"
                  tabIndex={-1}
                  aria-live="assertive"
                  role="alert"
                  className="register-error"
                >
                  {errors.root.message}
                </Alert>
              )}

              <div className="register-field">
                <FloatingLabel
                  variant="outlined"
                  id="email"
                  label="E-post"
                  type="email"
                  autoComplete="email"
                  {...register('email')}
                  color={errors.email ? 'error' : undefined}
                  aria-describedby={errors.email ? 'email-error' : undefined}
                  aria-invalid={!!errors.email}
                  required
                />
                {errors.email && (
                  <p id="email-error" className="auth-field-error">
                    {errors.email.message}
                  </p>
                )}
              </div>

              <div className="register-field">
                <FloatingLabel
                  variant="outlined"
                  id="password"
                  label="Passord"
                  type="password"
                  autoComplete="new-password"
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
                    Oppretter konto...
                  </span>
                ) : (
                  'Opprett konto'
                )}
              </Button>
            </form>

            <div className="register-links">
              <div>
                <Link to="/login" className="register-link">
                  Har du allerede en konto? Logg inn
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
