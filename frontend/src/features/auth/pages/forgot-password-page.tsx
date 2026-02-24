import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import { Alert, Button, FloatingLabel, Spinner } from 'flowbite-react';
import { useForgotPasswordMutation } from '../../../services/api/auth-api';
import { forgotPasswordSchema, type ForgotPasswordFormData } from '../types/forgot-password-schema';

export function ForgotPasswordPage() {
  const [forgotPassword, { isLoading }] = useForgotPasswordMutation();
  const errorAlertRef = useRef<HTMLDivElement>(null);
  const [submitted, setSubmitted] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setFocus,
    setError,
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    mode: 'onSubmit',
    reValidateMode: 'onSubmit',
  });

  useEffect(() => {
    setFocus('email');
  }, [setFocus]);

  useEffect(() => {
    if (errors.root) {
      errorAlertRef.current?.focus();
    }
  }, [errors.root]);

  const onSubmit = async (data: ForgotPasswordFormData) => {
    try {
      await forgotPassword({ email: data.email }).unwrap();
      setSubmitted(true);
    } catch (error) {
      const status =
        error && typeof error === 'object' && 'status' in error
          ? (error as { status?: number }).status ?? 0
          : 0;
      // 404/501: endpoint not implemented yet – show success anyway for consistent UX
      if (status === 404 || status === 501) {
        setSubmitted(true);
        return;
      }
      const message =
        error && typeof error === 'object' && 'message' in error
          ? (error as { message?: string }).message
          : 'Something went wrong. Please try again later.';
      setError('root', { type: 'server', message });
    }
  };

  if (submitted) {
    return (
      <section className="forgot-password-page">
        <div className="forgot-password-container">
          <div className="forgot-password-card">
            <div className="forgot-password-card-inner">
              <h1 className="forgot-password-title">Tracefield Lab</h1>
              <h2 className="forgot-password-subtitle">Check your email</h2>
              <p className="forgot-password-success-text">
                If an account exists with the email you entered, we have sent you a link to reset
                your password.
              </p>
              <p className="forgot-password-success-note">
                Check your spam folder if you don&apos;t see the email.
              </p>
              <div className="forgot-password-links">
                <Link to="/login" className="forgot-password-link">
                  Back to sign in
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="forgot-password-page">
      <div className="forgot-password-container">
        <div className="forgot-password-card">
          <div className="forgot-password-card-inner">
            <h1 className="forgot-password-title">Tracefield Lab</h1>
            <h2 className="forgot-password-subtitle">Forgot password</h2>
            <p className="forgot-password-intro">
              Enter your email address and we&apos;ll send you a link to reset your password.
            </p>

            <form onSubmit={handleSubmit(onSubmit)} noValidate className="forgot-password-form">
              {errors.root && (
                <Alert
                  ref={errorAlertRef}
                  color="failure"
                  tabIndex={-1}
                  aria-live="assertive"
                  role="alert"
                  className="forgot-password-error"
                >
                  {errors.root.message}
                </Alert>
              )}

              <div className="forgot-password-field">
                <FloatingLabel
                  variant="outlined"
                  id="email"
                  label="Email"
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

              <Button type="submit" disabled={isLoading} className="ui-button">
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Spinner size="sm" />
                    Sending...
                  </span>
                ) : (
                  'Send reset link'
                )}
              </Button>
            </form>

            <div className="forgot-password-links">
              <Link to="/login" className="forgot-password-link">
                Back to sign in
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
