/**
 * ForgotPasswordForm — `POST /auth/password-reset/request`. Mirrors
 * `LoginForm.jsx`'s pattern (React Hook Form + `Controller`, shared
 * validation copy), but the mutation always resolves the same way
 * whether or not the email matched a real account — the success state
 * below is shown unconditionally on a successful response, never
 * branched on account existence (FRONTEND_ARCHITECTURE.md §15.3 doesn't
 * cover this case specifically, but the same "server error vs. field
 * error" split applies: a network/validation failure still surfaces via
 * `error`, an account-enumeration signal never does).
 */

import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useParams, Link } from 'react-router-dom';
import { Input } from '@desavii/ui/components/form-controls';
import { Button } from '@desavii/ui/components/primitives';
import { Alert } from '@desavii/ui/components/feedback-overlays';
import { Stack } from '@desavii/ui/components/layout';
import { useRequestPasswordResetMutation } from '../../mutations/useRequestPasswordResetMutation.js';

export default function ForgotPasswordForm() {
  const { t, i18n } = useTranslation();
  const { locale } = useParams();
  const [submitted, setSubmitted] = useState(false);
  const { mutateAsync, isPending, error } = useRequestPasswordResetMutation();

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm({ defaultValues: { email: '' } });

  async function onSubmit(values) {
    try {
      await mutateAsync({
        email: values.email,
        locale: locale ?? i18n.language,
      });
      setSubmitted(true);
    } catch {
      // Surfaced below via the mutation's `error` state — a genuine
      // request failure (network/validation), never an
      // account-not-found signal, which this endpoint never produces.
    }
  }

  if (submitted) {
    return (
      <Stack gap="4">
        <Alert variant="success">{t('auth.forgotPassword.success')}</Alert>
        <p>
          <Link to={`/${locale}/auth/login`}>
            {t('auth.forgotPassword.backToLogin')}
          </Link>
        </p>
      </Stack>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <Stack gap="4">
        <p>{t('auth.forgotPassword.description')}</p>

        {error && (
          <Alert variant="danger">
            {t('auth.forgotPassword.genericError')}
          </Alert>
        )}

        <Controller
          name="email"
          control={control}
          rules={{
            required: t('auth.validation.emailRequired'),
            pattern: {
              value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
              message: t('auth.validation.emailInvalid'),
            },
          }}
          render={({ field }) => (
            <Input
              type="email"
              label={t('auth.forgotPassword.email')}
              required
              error={errors.email?.message}
              // eslint-disable-next-line react/jsx-props-no-spreading
              {...field}
            />
          )}
        />

        <Button type="submit" variant="primary" fullWidth loading={isPending}>
          {t('auth.forgotPassword.submit')}
        </Button>

        <p>
          <Link to={`/${locale}/auth/login`}>
            {t('auth.forgotPassword.backToLogin')}
          </Link>
        </p>
      </Stack>
    </form>
  );
}
