/**
 * PartnerProfilePageContent — `/:locale/partner/profile` (P1.3, Master
 * Roadmap). The partner's own public company identity: name, contact
 * info, social links, logo/cover, and a description authored in
 * whichever locale the dashboard is currently viewed in — same
 * single-current-locale convention `PartnerListingWizard`'s
 * `BasicInfoStep` already established (`LANGUAGE_ID_BY_LOCALE`'s own
 * doc comment explains why: no `GET /languages` endpoint exists to
 * drive a real per-locale tab picker yet).
 *
 * Read access is any active `partner_employees` member; write access
 * requires `MANAGE_COMPANY_PROFILE` (`usePartnerCapability`, mirroring
 * the server-side `partnerService.js#assertCanManageProfile` check —
 * this only hides/disables controls a non-manager's request would 403
 * on anyway).
 *
 * `ProfileForm` only ever mounts once `profile` is already loaded
 * (never while `profileQuery.isPending`), with `defaultValues` computed
 * up front — same `PartnerApplicationPageContent.jsx`'s `ApplicationForm`/
 * `toFormValues` split this mirrors, and for the identical reason:
 * `useForm`'s reactive `values` option resyncs via a post-mount effect,
 * so a Controller can briefly render `undefined` on its very first
 * paint before that effect runs — a real "uncontrolled input becoming
 * controlled" React warning, confirmed while building this page.
 * `defaultValues` has no such lag since it's read synchronously at
 * `useForm()`'s own call time.
 */

import { useRef } from 'react';
import PropTypes from 'prop-types';
import { useForm, Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import {
  Image,
  Building2,
  Share2,
  ShieldCheck,
  ExternalLink,
} from 'lucide-react';
import { Input, Textarea } from '@desavii/ui/components/form-controls';
import { Button, Card } from '@desavii/ui/components/primitives';
import { Skeleton, ErrorState } from '@desavii/ui/components/feedback-overlays';
import { Section, Stack, Inline, Grid } from '@desavii/ui/components/layout';
import PageHeader from '../../../../components/PageHeader/PageHeader.jsx';
import RouterLink from '../../../../components/RouterLink.jsx';
import { useToast } from '../../../../contexts/ToastContext.jsx';
import { usePartnerContext } from '../../../../contexts/PartnerContext.jsx';
import {
  usePartnerCapability,
  PARTNER_CAPABILITIES,
} from '../../../availability/index.js';
import getLocalizedTranslation from '../../../listings/utils/getLocalizedTranslation.js';
import { useMyCompanyProfileQuery } from '../../queries/useMyCompanyProfileQuery.js';
import { useUpdateCompanyProfileMutation } from '../../mutations/useUpdateCompanyProfileMutation.js';
import { useUploadCompanyLogoMutation } from '../../mutations/useUploadCompanyLogoMutation.js';
import { useUploadCompanyCoverMutation } from '../../mutations/useUploadCompanyCoverMutation.js';
import styles from './PartnerProfilePageContent.module.scss';

const ACCEPTED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const SOCIAL_PLATFORMS = [
  'facebook',
  'instagram',
  'x',
  'youtube',
  'tiktok',
  'linkedin',
];

function toFormValues(profile, locale) {
  return {
    displayName: profile?.display_name ?? '',
    email: profile?.email ?? '',
    phone: profile?.phone ?? '',
    website: profile?.website ?? '',
    description:
      getLocalizedTranslation(profile?.translations, locale)?.description ?? '',
    socialLinks: SOCIAL_PLATFORMS.reduce(
      (acc, platform) => ({
        ...acc,
        [platform]: profile?.social_links?.[platform] ?? '',
      }),
      {},
    ),
  };
}

function ImageUploadTrigger({
  label,
  imageUrl = undefined,
  isUploading,
  disabled,
  onUpload,
  onValidationError,
}) {
  const inputRef = useRef(null);

  function handleFileChange(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!ACCEPTED_MIME_TYPES.includes(file.type)) {
      onValidationError();
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      onValidationError();
      return;
    }
    onUpload(file);
  }

  return (
    <Stack gap="2">
      {imageUrl && (
        // eslint-disable-next-line jsx-a11y/img-redundant-alt -- purely decorative preview, alt intentionally empty
        <img
          src={imageUrl}
          alt=""
          style={{ maxWidth: '100%', maxHeight: 160 }}
        />
      )}
      <Button
        type="button"
        variant="secondary"
        size="sm"
        loading={isUploading}
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
      >
        {label}
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_MIME_TYPES.join(',')}
        style={{ display: 'none' }}
        onChange={handleFileChange}
        aria-hidden="true"
        tabIndex={-1}
      />
    </Stack>
  );
}

ImageUploadTrigger.propTypes = {
  label: PropTypes.string.isRequired,
  imageUrl: PropTypes.string,
  isUploading: PropTypes.bool.isRequired,
  disabled: PropTypes.bool.isRequired,
  onUpload: PropTypes.func.isRequired,
  onValidationError: PropTypes.func.isRequired,
};

function ProfileForm({ defaultValues, canManage, onSave, isSaving }) {
  const { t } = useTranslation();
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm({ defaultValues });

  return (
    <form onSubmit={handleSubmit(onSave)} noValidate>
      <Stack gap="4">
        <h2 className={styles.panelHeading}>
          <Building2 aria-hidden="true" focusable="false" />
          {t('partner.profile.sections.identity')}
        </h2>
        <Controller
          name="displayName"
          control={control}
          rules={{
            required: t('partner.profile.validation.displayNameRequired'),
          }}
          render={({ field }) => (
            <Input
              label={t('partner.profile.fields.displayNameLabel')}
              required
              disabled={!canManage}
              error={errors.displayName?.message}
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
              label={t('partner.profile.fields.descriptionLabel')}
              helperText={t('partner.profile.fields.descriptionHelper')}
              disabled={!canManage}
              rows={5}
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
                value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                message: t('partner.profile.validation.emailInvalid'),
              },
            }}
            render={({ field }) => (
              <Input
                type="email"
                label={t('partner.profile.fields.emailLabel')}
                disabled={!canManage}
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
                label={t('partner.profile.fields.phoneLabel')}
                disabled={!canManage}
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
              value: /^https?:\/\/.+/i,
              message: t('partner.profile.validation.websiteInvalid'),
            },
          }}
          render={({ field }) => (
            <Input
              type="url"
              label={t('partner.profile.fields.websiteLabel')}
              placeholder="https://"
              disabled={!canManage}
              error={errors.website?.message}
              // eslint-disable-next-line react/jsx-props-no-spreading
              {...field}
            />
          )}
        />

        <h2 className={styles.panelHeading}>
          <Share2 aria-hidden="true" focusable="false" />
          {t('partner.profile.sections.social')}
        </h2>
        <Grid columns={2} gap="4">
          {SOCIAL_PLATFORMS.map((platform) => (
            <Controller
              key={platform}
              name={`socialLinks.${platform}`}
              control={control}
              rules={{
                pattern: {
                  value: /^https?:\/\/.+/i,
                  message: t('partner.profile.validation.websiteInvalid'),
                },
              }}
              render={({ field }) => (
                <Input
                  type="url"
                  label={t(`partner.profile.social.${platform}`)}
                  placeholder="https://"
                  disabled={!canManage}
                  error={errors.socialLinks?.[platform]?.message}
                  // eslint-disable-next-line react/jsx-props-no-spreading
                  {...field}
                />
              )}
            />
          ))}
        </Grid>

        {canManage && (
          <Inline>
            <Button type="submit" variant="primary" loading={isSaving}>
              {t('partner.profile.saveAction')}
            </Button>
          </Inline>
        )}
      </Stack>
    </form>
  );
}

ProfileForm.propTypes = {
  defaultValues: PropTypes.shape({
    displayName: PropTypes.string,
    email: PropTypes.string,
    phone: PropTypes.string,
    website: PropTypes.string,
    description: PropTypes.string,
    // eslint-disable-next-line react/forbid-prop-types -- a small, fixed set of platform keys, not worth a full nested shape
    socialLinks: PropTypes.object,
  }).isRequired,
  canManage: PropTypes.bool.isRequired,
  onSave: PropTypes.func.isRequired,
  isSaving: PropTypes.bool.isRequired,
};

export default function PartnerProfilePageContent() {
  const { t, i18n } = useTranslation();
  const { locale } = useParams();
  const { showToast } = useToast();
  const { activePartnerId } = usePartnerContext();
  const canManage = usePartnerCapability(
    PARTNER_CAPABILITIES.MANAGE_COMPANY_PROFILE,
  );

  const profileQuery = useMyCompanyProfileQuery(activePartnerId);
  const updateMutation = useUpdateCompanyProfileMutation(activePartnerId);
  const uploadLogoMutation = useUploadCompanyLogoMutation(activePartnerId);
  const uploadCoverMutation = useUploadCompanyCoverMutation(activePartnerId);

  if (profileQuery.isError) {
    return (
      <Section spacing="default">
        <ErrorState
          title={t('partner.profile.error.title')}
          retryLabel={t('partner.profile.error.retry')}
          onRetry={profileQuery.refetch}
        />
      </Section>
    );
  }

  const profile = profileQuery.data;

  async function handleSave(values) {
    try {
      await updateMutation.mutateAsync({
        displayName: values.displayName,
        email: values.email,
        phone: values.phone,
        website: values.website,
        description: values.description,
        locale: i18n.language,
        socialLinks: values.socialLinks,
      });
      showToast(t('partner.profile.saveSuccess'), { variant: 'success' });
    } catch {
      showToast(t('partner.profile.saveError'), { variant: 'danger' });
    }
  }

  async function handleUploadLogo(file) {
    try {
      await uploadLogoMutation.mutateAsync(file);
      showToast(t('partner.profile.logoUploadSuccess'), { variant: 'success' });
    } catch {
      showToast(t('partner.profile.uploadError'), { variant: 'danger' });
    }
  }

  async function handleUploadCover(file) {
    try {
      await uploadCoverMutation.mutateAsync(file);
      showToast(t('partner.profile.coverUploadSuccess'), {
        variant: 'success',
      });
    } catch {
      showToast(t('partner.profile.uploadError'), { variant: 'danger' });
    }
  }

  return (
    <Section spacing="default">
      <PageHeader
        title={t('partner.profile.heading')}
        breadcrumbs={[
          { label: t('nav.home'), href: `/${locale}` },
          { label: t('partner.nav.dashboard'), href: `/${locale}/partner` },
          {
            label: t('partner.profile.heading'),
            href: `/${locale}/partner/profile`,
          },
        ]}
        actions={
          profile?.slug && (
            <RouterLink
              href={`/${locale}/companies/${profile.slug}`}
              className={styles.publicProfileLink}
            >
              <ExternalLink size={14} aria-hidden="true" focusable="false" />
              {t('partner.profile.viewPublicProfile')}
            </RouterLink>
          )
        }
      />

      {profileQuery.isPending ? (
        <Skeleton variant="text" width="60%" />
      ) : (
        <Stack gap="6">
          {profile.is_verified && (
            <Inline gap="2" align="center" className={styles.verifiedBanner}>
              <ShieldCheck size={16} aria-hidden="true" focusable="false" />
              <span>{t('companies.card.verified')}</span>
              <span className={styles.publicProfileNote}>
                {t('partner.profile.publicProfileNote')}
              </span>
            </Inline>
          )}
          {!profile.is_verified && (
            <p className={styles.publicProfileNote}>
              {t('partner.profile.publicProfileNote')}
            </p>
          )}

          <Card padding="lg">
            <Stack gap="3">
              <h2 className={styles.panelHeading}>
                <Image aria-hidden="true" focusable="false" />
                {t('partner.profile.sections.media')}
              </h2>
              <Grid columns={2} gap="4">
                <ImageUploadTrigger
                  label={t('partner.profile.uploadLogo')}
                  imageUrl={profile.logo_url}
                  isUploading={uploadLogoMutation.isPending}
                  disabled={!canManage}
                  onUpload={(file) => handleUploadLogo(file)}
                  onValidationError={() =>
                    showToast(t('partner.profile.uploadValidationError'), {
                      variant: 'danger',
                    })
                  }
                />
                <ImageUploadTrigger
                  label={t('partner.profile.uploadCover')}
                  imageUrl={profile.cover_url}
                  isUploading={uploadCoverMutation.isPending}
                  disabled={!canManage}
                  onUpload={(file) => handleUploadCover(file)}
                  onValidationError={() =>
                    showToast(t('partner.profile.uploadValidationError'), {
                      variant: 'danger',
                    })
                  }
                />
              </Grid>
            </Stack>
          </Card>

          <Card padding="lg">
            <ProfileForm
              defaultValues={toFormValues(profile, i18n.language)}
              canManage={canManage}
              onSave={(values) => handleSave(values)}
              isSaving={updateMutation.isPending}
            />
          </Card>
        </Stack>
      )}
    </Section>
  );
}
