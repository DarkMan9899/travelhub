/**
 * ProfileForm — personal info + language/currency preferences, wired to
 * `PATCH /users/:id` via `useUpdateProfileMutation`. Mirrors
 * `RegisterForm.jsx`'s React Hook Form + `Controller` pattern exactly.
 * Only the fields `updateProfileSchema` actually accepts are editable
 * here — no email (immutable post-registration, no endpoint supports it)
 * and no timezone/bio (no backing columns exist, see the module README).
 */

import { useForm, Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Input, Select } from '@travelhub/ui/components/form-controls';
import { Button } from '@travelhub/ui/components/primitives';
import { Alert } from '@travelhub/ui/components/feedback-overlays';
import { Stack, Inline } from '@travelhub/ui/components/layout';
import PropTypes from 'prop-types';
import { SUPPORTED_LOCALES } from '../../../../translations/i18n.js';
import { LANGUAGE_ID_BY_LOCALE } from '../../../listings/constants/languageIds.js';
import { CURRENCY_CODES } from '../../../listings/constants/currencies.js';
import { CURRENCY_ID_BY_CODE } from '../../constants/currencyIds.js';

export default function ProfileForm({ user, onSave }) {
  const { t } = useTranslation();

  const {
    control,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm({
    defaultValues: {
      firstName: user.first_name ?? '',
      lastName: user.last_name ?? '',
      phone: user.phone ?? '',
      preferredLanguageId: user.preferred_language_id ?? '',
      preferredCurrencyId: user.preferred_currency_id ?? '',
    },
  });

  const languageOptions = SUPPORTED_LOCALES.map((code) => ({
    value: LANGUAGE_ID_BY_LOCALE[code],
    label: t(`profile.form.languageOptions.${code}`),
  }));
  const currencyOptions = CURRENCY_CODES.map((code) => ({
    value: CURRENCY_ID_BY_CODE[code],
    label: t(`profile.form.currencyOptions.${code}`),
  }));

  function onSubmit(values) {
    return onSave({
      firstName: values.firstName,
      lastName: values.lastName,
      phone: values.phone || undefined,
      preferredLanguageId: values.preferredLanguageId || undefined,
      preferredCurrencyId: values.preferredCurrencyId || undefined,
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <Stack gap="4">
        <Inline gap="4" wrap>
          <Controller
            name="firstName"
            control={control}
            rules={{ required: t('auth.validation.firstNameRequired') }}
            render={({ field }) => (
              <Input
                label={t('profile.form.firstName')}
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
                label={t('profile.form.lastName')}
                required
                error={errors.lastName?.message}
                // eslint-disable-next-line react/jsx-props-no-spreading
                {...field}
              />
            )}
          />
        </Inline>

        <Controller
          name="phone"
          control={control}
          render={({ field }) => (
            // eslint-disable-next-line react/jsx-props-no-spreading
            <Input {...field} type="tel" label={t('profile.form.phone')} />
          )}
        />

        <Inline gap="4" wrap>
          <Controller
            name="preferredLanguageId"
            control={control}
            render={({ field }) => (
              <Select
                label={t('profile.form.preferredLanguage')}
                options={languageOptions}
                value={field.value}
                onChange={(value) => field.onChange(value)}
                placeholder={t('profile.form.selectPlaceholder')}
              />
            )}
          />
          <Controller
            name="preferredCurrencyId"
            control={control}
            render={({ field }) => (
              <Select
                label={t('profile.form.preferredCurrency')}
                options={currencyOptions}
                value={field.value}
                onChange={(value) => field.onChange(value)}
                placeholder={t('profile.form.selectPlaceholder')}
              />
            )}
          />
        </Inline>

        {!user.is_email_verified && (
          <Alert variant="warning">{t('profile.form.emailUnverified')}</Alert>
        )}

        <div>
          <Button type="submit" variant="primary" disabled={!isDirty}>
            {t('profile.form.save')}
          </Button>
        </div>
      </Stack>
    </form>
  );
}

ProfileForm.propTypes = {
  user: PropTypes.shape({
    first_name: PropTypes.string,
    last_name: PropTypes.string,
    phone: PropTypes.string,
    preferred_language_id: PropTypes.number,
    preferred_currency_id: PropTypes.number,
    is_email_verified: PropTypes.bool,
  }).isRequired,
  onSave: PropTypes.func.isRequired,
};
