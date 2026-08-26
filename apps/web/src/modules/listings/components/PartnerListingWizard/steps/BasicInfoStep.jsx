/**
 * BasicInfoStep — step 2, and the step that actually calls
 * `POST /listings` (React Hook Form + `Controller`, per
 * FRONTEND_ARCHITECTURE.md §15.1 — same pattern `LoginForm.jsx`
 * established). Once a `listingId` exists, `partnerId`/`listingType`
 * become read-only: `updateListingSchema`'s body has no field for
 * either (a listing's owning partner and fundamental type are only ever
 * set at creation) — so this step edits translations only from then on.
 *
 * `translations` is a single entry in the wizard's current UI locale —
 * a genuine simplification against `createListingSchema`'s full
 * multi-language array, since asking a partner to fill in three
 * languages before they can even see step 3 would be a poor first-run
 * experience. Add-a-translation for other locales is left to a future
 * "Translations" concern this phase's brief never asked for.
 */

import { useForm, Controller } from 'react-hook-form';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { Input, Textarea, Select } from '@desavii/ui/components/form-controls';
import { Alert } from '@desavii/ui/components/feedback-overlays';
import { Stack } from '@desavii/ui/components/layout';
import { useCreateListingMutation } from '../../../mutations/useCreateListingMutation.js';
import { useUpdateListingMutation } from '../../../mutations/useUpdateListingMutation.js';
import { LISTING_TYPES } from '../../../constants/listingTypes.js';
import { LANGUAGE_ID_BY_LOCALE } from '../../../constants/languageIds.js';
import WizardStepActions from '../WizardStepActions.jsx';

export default function BasicInfoStep({
  listingId = null,
  categoryId = null,
  partnerships,
  initialValues = {},
  onCreated,
  onBack = undefined,
  onNext,
}) {
  const { t } = useTranslation();
  const { locale } = useParams();
  const createListingMutation = useCreateListingMutation();
  const updateListingMutation = useUpdateListingMutation();
  const isSubmitting =
    createListingMutation.isPending || updateListingMutation.isPending;
  const submitError =
    createListingMutation.error || updateListingMutation.error;

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm({
    defaultValues: {
      partnerId: initialValues.partnerId ?? partnerships[0]?.partner_id ?? null,
      listingType: initialValues.listingType ?? null,
      title: initialValues.title ?? '',
      summary: initialValues.summary ?? '',
      description: initialValues.description ?? '',
    },
  });

  async function onSubmit(values) {
    const translations = [
      {
        languageId: LANGUAGE_ID_BY_LOCALE[locale],
        title: values.title,
        summary: values.summary || undefined,
        description: values.description || undefined,
      },
    ];

    if (listingId) {
      await updateListingMutation.mutateAsync({
        id: listingId,
        payload: { translations },
      });
      onNext();
      return;
    }

    const { data } = await createListingMutation.mutateAsync({
      partnerId: values.partnerId,
      listingType: values.listingType,
      translations,
      categoryIds: categoryId ? [categoryId] : undefined,
    });
    // `onCreated` (wired to `wizard.completeCreationStep`) sets `listingId`
    // AND advances to the next step in one URL update — calling `onNext()`
    // separately here would race it via a second, independent
    // `setSearchParams` call and silently drop the `listingId`.
    onCreated(data.id);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <h2>{t('partner.listingWizard.steps.basicInfo')}</h2>
      <Stack gap="4">
        {submitError && <Alert variant="danger">{submitError.message}</Alert>}

        {!listingId && partnerships.length > 1 && (
          <Controller
            name="partnerId"
            control={control}
            rules={{ required: t('partner.listingWizard.validation.required') }}
            render={({ field }) => (
              <Select
                label={t('partner.listingWizard.basicInfo.partner')}
                placeholder={t('partner.listingWizard.selectPlaceholder')}
                options={partnerships.map((partnership) => ({
                  value: partnership.partner_id,
                  label: partnership.display_name,
                }))}
                error={errors.partnerId?.message}
                required
                // eslint-disable-next-line react/jsx-props-no-spreading
                {...field}
              />
            )}
          />
        )}

        {!listingId && (
          <Controller
            name="listingType"
            control={control}
            rules={{ required: t('partner.listingWizard.validation.required') }}
            render={({ field }) => (
              <Select
                label={t('partner.listingWizard.basicInfo.listingType')}
                placeholder={t('partner.listingWizard.selectPlaceholder')}
                options={LISTING_TYPES.map((code) => ({
                  value: code,
                  label: t(`partner.listingWizard.listingTypes.${code}`, code),
                }))}
                error={errors.listingType?.message}
                required
                // eslint-disable-next-line react/jsx-props-no-spreading
                {...field}
              />
            )}
          />
        )}

        <Controller
          name="title"
          control={control}
          rules={{ required: t('partner.listingWizard.validation.required') }}
          render={({ field }) => (
            <Input
              label={t('partner.listingWizard.basicInfo.title')}
              error={errors.title?.message}
              required
              // eslint-disable-next-line react/jsx-props-no-spreading
              {...field}
            />
          )}
        />

        <Controller
          name="summary"
          control={control}
          render={({ field }) => (
            <Input
              label={t('partner.listingWizard.basicInfo.summary')}
              // eslint-disable-next-line react/jsx-props-no-spreading
              {...field}
            />
          )}
        />

        <Controller
          name="description"
          control={control}
          render={({ field }) => (
            <Textarea
              label={t('partner.listingWizard.basicInfo.description')}
              rows={6}
              // eslint-disable-next-line react/jsx-props-no-spreading
              {...field}
            />
          )}
        />
      </Stack>

      <WizardStepActions
        onBack={onBack}
        onContinue={handleSubmit(onSubmit)}
        isSubmitting={isSubmitting}
        backLabel={t('partner.listingWizard.back')}
        continueLabel={t('partner.listingWizard.continue')}
      />
    </form>
  );
}

const partnershipShape = PropTypes.shape({
  partner_id: PropTypes.number.isRequired,
  display_name: PropTypes.string.isRequired,
});

BasicInfoStep.propTypes = {
  listingId: PropTypes.number,
  categoryId: PropTypes.number,
  partnerships: PropTypes.arrayOf(partnershipShape).isRequired,
  initialValues: PropTypes.shape({
    partnerId: PropTypes.number,
    listingType: PropTypes.string,
    title: PropTypes.string,
    summary: PropTypes.string,
    description: PropTypes.string,
  }),
  onCreated: PropTypes.func.isRequired,
  onBack: PropTypes.func,
  onNext: PropTypes.func.isRequired,
};
