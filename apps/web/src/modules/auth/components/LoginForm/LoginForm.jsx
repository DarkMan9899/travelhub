/**
 * LoginForm — the module's real, working login form
 * (FRONTEND_ARCHITECTURE.md §15.1: React Hook Form + `Controller`
 * wrapping the platform's controlled `ui/` `Input`). Connects to the
 * real `POST /auth/login` endpoint via `useLoginMutation`.
 *
 * Phase 10 redesign — role-aware post-login redirect: an explicit
 * `?redirect=` (set by `RequireAuth`/`RequirePartner` when they bounced
 * an unauthenticated/non-partner visitor here) always wins. Otherwise,
 * a user who belongs to at least one partner org lands on `/partner`
 * (they came here primarily to run their business) unless
 * `getLastWorkspace()` remembers they last chose "customer" — the
 * "workspace selector OR last-used workspace" requirement. `partnerships`
 * is read from `useLoginMutation`'s *resolved value*
 * (`AuthProvider.login()`'s return, Phase 10 addition), not from
 * `useAuth()` — the latter is a stale render-time closure at this point,
 * since this component hasn't re-rendered yet with the just-hydrated
 * session.
 *
 * Phase 11 (Admin Platform) adds a role-based branch, checked BEFORE the
 * partnership check: an ADMIN/SUPER_ADMIN/MODERATOR/SUPPORT user has no
 * customer/partner persona to land on by default, and isn't offered as a
 * workspace-switcher option (unlike Customer<->Partner) — they always
 * land on `/admin` unless `?redirect=` says otherwise. `roles` is read
 * from the same resolved `login()` value as `partnerships`, for the
 * identical stale-closure reason.
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
import { Stack } from '@desavii/ui/components/layout';
import { useLoginMutation } from '../../mutations/useLoginMutation.js';
import { getLastWorkspace } from '../../../../utils/workspacePreference.js';

const ADMIN_AREA_ROLES = ['ADMIN', 'SUPER_ADMIN', 'MODERATOR', 'SUPPORT'];

export default function LoginForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { locale } = useParams();
  const [searchParams] = useSearchParams();
  const { mutateAsync, isPending, error } = useLoginMutation();

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm({ defaultValues: { email: '', password: '' } });

  async function onSubmit(values) {
    try {
      const { partnerships, roles } = await mutateAsync(values);
      const redirect = searchParams.get('redirect');
      const isAdminAreaRole = roles.some((role) =>
        ADMIN_AREA_ROLES.includes(role),
      );
      const isPartner = partnerships.length > 0;
      let destination;
      if (redirect) {
        destination = redirect;
      } else if (isAdminAreaRole) {
        destination = `/${locale}/admin`;
      } else if (isPartner && getLastWorkspace() !== 'customer') {
        destination = `/${locale}/partner`;
      } else {
        destination = `/${locale}/account`;
      }
      navigate(destination, { replace: true });
    } catch {
      // Surfaced below via the mutation's `error` state — no further
      // action needed here (FRONTEND_ARCHITECTURE.md §15.3's server-error
      // path doesn't apply to login: 401 on bad credentials isn't a
      // per-field VALIDATION_FAILED response, it's a single top-level
      // failure).
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <Stack gap="4">
        {error && <Alert variant="danger">{error.message}</Alert>}

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
            // React Hook Form's own documented Controller pattern
            // (FRONTEND_ARCHITECTURE.md §15.1) — `field` is the
            // value/onChange/onBlur/name/ref bundle this control needs.
            <Input
              type="email"
              label={t('auth.login.email')}
              required
              error={errors.email?.message}
              // eslint-disable-next-line react/jsx-props-no-spreading
              {...field}
            />
          )}
        />

        <Controller
          name="password"
          control={control}
          rules={{ required: t('auth.validation.passwordRequired') }}
          render={({ field }) => (
            <Input
              type="password"
              label={t('auth.login.password')}
              required
              error={errors.password?.message}
              // eslint-disable-next-line react/jsx-props-no-spreading
              {...field}
            />
          )}
        />

        <Button type="submit" variant="primary" fullWidth loading={isPending}>
          {t('auth.login.submit')}
        </Button>

        <p>
          {t('auth.login.noAccount')}{' '}
          <Link to={`/${locale}/auth/register`}>
            {t('auth.login.registerLink')}
          </Link>
        </p>
      </Stack>
    </form>
  );
}
