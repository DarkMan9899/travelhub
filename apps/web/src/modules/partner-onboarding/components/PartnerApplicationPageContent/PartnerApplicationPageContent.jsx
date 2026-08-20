/**
 * PartnerApplicationPageContent — `/:locale/partner/apply` (P1.2, Master
 * Roadmap). Wrapped in `RequireAuth` only, deliberately NOT
 * `RequirePartner` — an applicant has no partnership yet, that's the
 * whole point of this page (see `routes/index.jsx`'s route-group
 * comment).
 *
 * `GET /partners/applications` (unfiltered — `useMyApplicationsQuery`)
 * decides which of three views renders, mirroring the backend's own
 * state machine (`partnerService.js`'s `IN_PROGRESS_STATUSES`):
 *  - an IN_PROGRESS application (DRAFT/PENDING/NEEDS_CHANGES) exists →
 *    status + edit view (editable only while DRAFT/NEEDS_CHANGES,
 *    read-only while PENDING).
 *  - no in-progress application, but an APPROVED one exists → this page
 *    has nothing left to do; redirect to the real partner dashboard.
 *  - neither (first-time applicant, or every prior application was
 *    REJECTED — REJECTED deliberately does not block starting a new one,
 *    same as the backend) → the create form.
 *
 * No document/KYC upload fields — see `partnerService.js`'s
 * `REQUIRED_FIELDS_TO_SUBMIT` comment for that deliberate future
 * extension point; this page only collects what the backend already
 * requires to submit for review (displayName, legalName, email, phone).
 */

import PropTypes from 'prop-types';
import { useForm, Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Navigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Input, Textarea } from '@travelhub/ui/components/form-controls';
import { Button, Card, Badge } from '@travelhub/ui/components/primitives';
import {
  Alert,
  Skeleton,
  ErrorState,
} from '@travelhub/ui/components/feedback-overlays';
import { Section, Stack, Inline } from '@travelhub/ui/components/layout';
import PageHeader from '../../../../components/PageHeader/PageHeader.jsx';
import { useToast } from '../../../../contexts/ToastContext.jsx';
import useNoIndex from '../../../../seo/useNoIndex.js';
import { submitPartnerApplication } from '../../../../api/partners.js';
import onboardingKeys from '../../constants/queryKeys.js';
import { useMyApplicationsQuery } from '../../queries/useMyApplicationsQuery.js';
import { useApplicationQuery } from '../../queries/useApplicationQuery.js';
import { useCreateApplicationMutation } from '../../mutations/useCreateApplicationMutation.js';
import { useUpdateApplicationMutation } from '../../mutations/useUpdateApplicationMutation.js';
import { useSubmitApplicationMutation } from '../../mutations/useSubmitApplicationMutation.js';

const IN_PROGRESS_STATUSES = ['DRAFT', 'PENDING', 'NEEDS_CHANGES'];
const EDITABLE_STATUSES = ['DRAFT', 'NEEDS_CHANGES'];
const REQUIRED_TO_SUBMIT = ['displayName', 'legalName', 'email', 'phone'];

const STATUS_BADGE_VARIANT = {
  DRAFT: 'neutral',
  PENDING: 'warning',
  NEEDS_CHANGES: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_PATTERN = /^https?:\/\/.+/i;

function ApplicationForm({
  defaultValues,
  readOnly,
  onSaveDraft,
  onSubmitForReview,
  isSaving,
  isSubmitting,
}) {
  const { t } = useTranslation();
  const {
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm({ defaultValues });

  const values = watch();
  const canSubmit = REQUIRED_TO_SUBMIT.every((field) =>
    Boolean(values[field]?.trim()),
  );

  return (
    <form onSubmit={handleSubmit(onSaveDraft)} noValidate>
      <Stack gap="4">
        <Controller
          name="displayName"
          control={control}
          rules={{
            required: t('partnerOnboarding.fields.displayNameRequired'),
          }}
          render={({ field }) => (
            <Input
              label={t('partnerOnboarding.fields.displayNameLabel')}
              required
              disabled={readOnly}
              error={errors.displayName?.message}
              // eslint-disable-next-line react/jsx-props-no-spreading
              {...field}
            />
          )}
        />

        <Controller
          name="legalName"
          control={control}
          render={({ field }) => (
            <Input
              label={t('partnerOnboarding.fields.legalNameLabel')}
              disabled={readOnly}
              helperText={t('partnerOnboarding.fields.legalNameHelper')}
              // eslint-disable-next-line react/jsx-props-no-spreading
              {...field}
            />
          )}
        />

        <Inline gap="4" wrap>
          <Controller
            name="email"
            control={control}
            rules={{
              pattern: {
                value: EMAIL_PATTERN,
                message: t('partnerOnboarding.fields.emailInvalid'),
              },
            }}
            render={({ field }) => (
              <Input
                type="email"
                label={t('partnerOnboarding.fields.emailLabel')}
                disabled={readOnly}
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
              <Input
                type="tel"
                label={t('partnerOnboarding.fields.phoneLabel')}
                disabled={readOnly}
                // eslint-disable-next-line react/jsx-props-no-spreading
                {...field}
              />
            )}
          />
        </Inline>

        <Controller
          name="website"
          control={control}
          rules={{
            pattern: {
              value: URL_PATTERN,
              message: t('partnerOnboarding.fields.websiteInvalid'),
            },
          }}
          render={({ field }) => (
            <Input
              type="url"
              label={t('partnerOnboarding.fields.websiteLabel')}
              disabled={readOnly}
              placeholder="https://"
              error={errors.website?.message}
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
              label={t('partnerOnboarding.fields.descriptionLabel')}
              disabled={readOnly}
              rows={5}
              // eslint-disable-next-line react/jsx-props-no-spreading
              {...field}
            />
          )}
        />

        {!readOnly && (
          <Inline gap="3" wrap>
            <Button type="submit" variant="secondary" loading={isSaving}>
              {t('partnerOnboarding.actions.saveDraft')}
            </Button>
            <Button
              type="button"
              variant="primary"
              loading={isSubmitting}
              disabled={!canSubmit}
              onClick={handleSubmit(onSubmitForReview)}
            >
              {t('partnerOnboarding.actions.submitForReview')}
            </Button>
          </Inline>
        )}
        {!readOnly && !canSubmit && (
          <p>{t('partnerOnboarding.status.submitRequiredFieldsHint')}</p>
        )}
      </Stack>
    </form>
  );
}

ApplicationForm.propTypes = {
  defaultValues: PropTypes.shape({
    displayName: PropTypes.string,
    legalName: PropTypes.string,
    email: PropTypes.string,
    phone: PropTypes.string,
    website: PropTypes.string,
    description: PropTypes.string,
  }).isRequired,
  readOnly: PropTypes.bool.isRequired,
  onSaveDraft: PropTypes.func.isRequired,
  onSubmitForReview: PropTypes.func.isRequired,
  isSaving: PropTypes.bool.isRequired,
  isSubmitting: PropTypes.bool.isRequired,
};

function toFormValues(application) {
  return {
    displayName: application?.display_name ?? '',
    legalName: application?.legal_name ?? '',
    email: application?.email ?? '',
    phone: application?.phone ?? '',
    website: application?.website ?? '',
    description: application?.description ?? '',
  };
}

export default function PartnerApplicationPageContent() {
  const { t } = useTranslation();
  const { locale } = useParams();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  useNoIndex();

  const applicationsQuery = useMyApplicationsQuery();
  const applications = applicationsQuery.data ?? [];
  const inProgressSummary = applications.find((application) =>
    IN_PROGRESS_STATUSES.includes(application.verification_status),
  );
  const hasApproved = applications.some(
    (application) => application.verification_status === 'APPROVED',
  );

  const applicationDetailQuery = useApplicationQuery(
    inProgressSummary?.partner_id,
    { enabled: Boolean(inProgressSummary) },
  );

  const createMutation = useCreateApplicationMutation();
  const updateMutation = useUpdateApplicationMutation(
    inProgressSummary?.partner_id,
  );
  const submitMutation = useSubmitApplicationMutation(
    inProgressSummary?.partner_id,
  );

  if (applicationsQuery.isPending) {
    return (
      <Section spacing="default">
        <Skeleton variant="text" width="60%" />
      </Section>
    );
  }

  if (applicationsQuery.isError) {
    return (
      <Section spacing="default">
        <ErrorState
          title={t('partnerOnboarding.error.title')}
          retryLabel={t('partnerOnboarding.error.retry')}
          onRetry={applicationsQuery.refetch}
        />
      </Section>
    );
  }

  if (!inProgressSummary && hasApproved) {
    return <Navigate to={`/${locale}/partner`} replace />;
  }

  const breadcrumbs = [
    { label: t('nav.home'), href: `/${locale}` },
    {
      label: t('partnerOnboarding.heading'),
      href: `/${locale}/partner/apply`,
    },
  ];

  async function handleCreate(values) {
    try {
      await createMutation.mutateAsync(values);
      showToast(t('partnerOnboarding.toast.createSuccess'), {
        variant: 'success',
      });
    } catch {
      showToast(t('partnerOnboarding.toast.error'), { variant: 'danger' });
    }
  }

  async function handleCreateAndSubmit(values) {
    try {
      const { data } = await createMutation.mutateAsync(values);
      await submitPartnerApplication(data.id);
      await queryClient.invalidateQueries({ queryKey: onboardingKeys.all });
      showToast(t('partnerOnboarding.toast.submitSuccess'), {
        variant: 'success',
      });
    } catch (err) {
      showToast(err?.message ?? t('partnerOnboarding.toast.error'), {
        variant: 'danger',
      });
    }
  }

  async function handleSaveDraft(values) {
    try {
      await updateMutation.mutateAsync(values);
      showToast(t('partnerOnboarding.toast.draftSaved'), {
        variant: 'success',
      });
    } catch {
      showToast(t('partnerOnboarding.toast.error'), { variant: 'danger' });
    }
  }

  async function handleSubmitForReview(values) {
    try {
      await updateMutation.mutateAsync(values);
      await submitMutation.mutateAsync();
      showToast(t('partnerOnboarding.toast.submitSuccess'), {
        variant: 'success',
      });
    } catch (err) {
      showToast(err?.message ?? t('partnerOnboarding.toast.error'), {
        variant: 'danger',
      });
    }
  }

  if (inProgressSummary) {
    const application = applicationDetailQuery.data;
    const status = inProgressSummary.verification_status;
    const readOnly = !EDITABLE_STATUSES.includes(status);

    return (
      <Section spacing="default">
        <PageHeader
          title={t('partnerOnboarding.heading')}
          breadcrumbs={breadcrumbs}
        />
        <Stack gap="6">
          <Card padding="lg">
            <Stack gap="4">
              <Inline justify="space-between" align="center" wrap>
                <strong>{inProgressSummary.display_name}</strong>
                <Badge
                  variant={STATUS_BADGE_VARIANT[status] ?? 'neutral'}
                  label={t(`partnerOnboarding.status.${status}`)}
                />
              </Inline>

              {status === 'PENDING' && (
                <Alert variant="info">
                  {t('partnerOnboarding.status.pendingNotice')}
                </Alert>
              )}
              {status === 'NEEDS_CHANGES' && application?.review_note && (
                <Alert variant="warning">
                  <strong>
                    {t('partnerOnboarding.status.reviewNoteLabel')}
                  </strong>
                  <p>{application.review_note}</p>
                </Alert>
              )}

              {applicationDetailQuery.isPending ? (
                <Skeleton variant="text" width="100%" />
              ) : (
                <ApplicationForm
                  defaultValues={toFormValues(application)}
                  readOnly={readOnly}
                  onSaveDraft={(values) => handleSaveDraft(values)}
                  onSubmitForReview={(values) => handleSubmitForReview(values)}
                  isSaving={updateMutation.isPending}
                  isSubmitting={
                    updateMutation.isPending || submitMutation.isPending
                  }
                />
              )}
            </Stack>
          </Card>
        </Stack>
      </Section>
    );
  }

  return (
    <Section spacing="default">
      <PageHeader
        title={t('partnerOnboarding.heading')}
        breadcrumbs={breadcrumbs}
      />
      <Stack gap="6">
        <p>{t('partnerOnboarding.lead')}</p>
        {applications.length > 0 && (
          <Alert variant="info">
            {t('partnerOnboarding.status.rejectedNotice')}
          </Alert>
        )}
        <Card padding="lg">
          <ApplicationForm
            defaultValues={toFormValues(null)}
            readOnly={false}
            onSaveDraft={(values) => handleCreate(values)}
            onSubmitForReview={(values) => handleCreateAndSubmit(values)}
            isSaving={createMutation.isPending}
            isSubmitting={createMutation.isPending}
          />
        </Card>
      </Stack>
    </Section>
  );
}
