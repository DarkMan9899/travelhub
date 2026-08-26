/**
 * RegisterForm — real, working registration form wired to `POST
 * /auth/register`, mirroring `LoginForm.jsx`'s pattern. Field-level
 * validation mirrors `registerSchema` (apps/api's auth validators)
 * field-for-field per FRONTEND_ARCHITECTURE.md §15.2, including the
 * password-strength policy (`schemas/passwordPolicy.js`).
 *
 * P1.4 (Master Roadmap): honors `?redirect=` the same way `LoginForm.jsx`
 * already does — `RequireAuth` sets it when it bounced a signed-out
 * visitor here, e.g. a staff-invitation link
 * (`partner/invitations/:token`) opened by someone with no account yet.
 * Falls back to `/account` when absent, unchanged from before.
 */

import { useForm, Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
  useNavigate,
  useParams,
  useSearchParams,
  Link,
} from 'react-router-dom';
import { Input } from '@desavii/ui/components/form-controls';
import { Button } from '@desavii/ui/components/primitives';
import { Alert } from '@desavii/ui/components/feedback-overlays';
import { Stack, Inline } from '@desavii/ui/components/layout';
import { useRegisterMutation } from '../../mutations/useRegisterMutation.js';
import { isStrongPassword } from '../../schemas/passwordPolicy.js';

export default function RegisterForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { locale } = useParams();
  const [searchParams] = useSearchParams();
  const { mutateAsync, isPending, error } = useRegisterMutation();

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm({
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      password: '',
    },
  });

  async function onSubmit(values) {
    try {
      await mutateAsync({ ...values, phone: values.phone || undefined });
      const redirect = searchParams.get('redirect');
      navigate(redirect || `/${locale}/account`, { replace: true });
    } catch {
      // Surfaced below via the mutation's `error` state.
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <Stack gap="4">
        {error && <Alert variant="danger">{error.message}</Alert>}

        <Inline gap="4" wrap>
          <Controller
            name="firstName"
            control={control}
            rules={{ required: t('auth.validation.firstNameRequired') }}
            render={({ field }) => (
              // React Hook Form's own documented Controller pattern
              // (FRONTEND_ARCHITECTURE.md §15.1).
              <Input
                label={t('auth.register.firstName')}
                required
                error={errors.firstName?.message}
                // eslint-disable-next-line react/jsx-props-no-spreading
                {...field}
              />
            )}
          />
          <Controller
            name="lastName"
            control={control}
            rules={{ required: t('auth.validation.lastNameRequired') }}
            render={({ field }) => (
              <Input
                label={t('auth.register.lastName')}
                required
                error={errors.lastName?.message}
                // eslint-disable-next-line react/jsx-props-no-spreading
                {...field}
              />
            )}
          />
        </Inline>

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
              label={t('auth.register.email')}
              required
              error={errors.email?.message}
              // eslint-disable-next-line react/jsx-props-no-spreading
              {...field}
            />
          )}
        />

        <Controller
          name="phone"
          control={control}
          render={({ field }) => (
            // eslint-disable-next-line react/jsx-props-no-spreading
            <Input {...field} type="tel" label={t('auth.register.phone')} />
          )}
        />

        <Controller
          name="password"
          control={control}
          rules={{
            required: t('auth.validation.passwordRequired'),
            validate: (value) =>
              isStrongPassword(value) || t('auth.validation.passwordWeak'),
          }}
          render={({ field }) => (
            <Input
              type="password"
              label={t('auth.register.password')}
              required
              helperText={
                errors.password ? undefined : t('auth.validation.passwordWeak')
              }
              error={errors.password?.message}
              // eslint-disable-next-line react/jsx-props-no-spreading
              {...field}
            />
          )}
        />

        <Button type="submit" variant="primary" fullWidth loading={isPending}>
          {t('auth.register.submit')}
        </Button>

        <p>
          {t('auth.register.haveAccount')}{' '}
          <Link to={`/${locale}/auth/login`}>
            {t('auth.register.loginLink')}
          </Link>
        </p>
      </Stack>
    </form>
  );
}
