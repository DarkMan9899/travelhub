/**
 * ProfilePageContent — `/:locale/account/profile`. Composes
 * `AvatarUploader` + `ProfileForm` over `useAuth().user` (already fully
 * hydrated — no separate `GET /users/:id` fetch needed, see
 * `authDto.js`'s Phase 8 additions). Both mutations call
 * `AuthContext.refreshUser()` on success, so this component never manages
 * its own "current user" copy — it always re-renders from the freshly
 * synced `useAuth().user`.
 *
 * 2026 Customer Account redesign: each section keeps the shared `Card`
 * panel treatment (Phase 10 redesign) but adds a small icon + one-line
 * description above its form (brief: "strong section hierarchy... clean
 * field grouping") — no change to `AvatarUploader`/`ProfileForm`
 * themselves or what they submit.
 */

import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { Section, Stack, Inline } from '@desavii/ui/components/layout';
import { Card } from '@desavii/ui/components/primitives';
import { ImageIcon, UserRound } from 'lucide-react';
import PageHeader from '../../../../components/PageHeader/PageHeader.jsx';
import { useAuth } from '../../../../contexts/AuthContext.jsx';
import { useToast } from '../../../../contexts/ToastContext.jsx';
import { useUpdateProfileMutation } from '../../mutations/useUpdateProfileMutation.js';
import { useUploadAvatarMutation } from '../../mutations/useUploadAvatarMutation.js';
import AvatarUploader from '../AvatarUploader/AvatarUploader.jsx';
import ProfileForm from '../ProfileForm/ProfileForm.jsx';
import styles from './ProfilePageContent.module.scss';

export default function ProfilePageContent() {
  const { t } = useTranslation();
  const { locale } = useParams();
  const { user } = useAuth();
  const { showToast } = useToast();
  const updateProfileMutation = useUpdateProfileMutation(user.id);
  const uploadAvatarMutation = useUploadAvatarMutation(user.id);

  async function handleSaveProfile(fields) {
    try {
      await updateProfileMutation.mutateAsync(fields);
      showToast(t('profile.form.saveSuccess'), { variant: 'success' });
    } catch {
      showToast(t('profile.form.saveError'), { variant: 'danger' });
    }
  }

  async function handleUploadAvatar(file) {
    try {
      await uploadAvatarMutation.mutateAsync(file);
      showToast(t('profile.avatar.uploadSuccess'), { variant: 'success' });
    } catch {
      showToast(t('profile.avatar.uploadError'), { variant: 'danger' });
    }
  }

  const fullName = `${user.first_name} ${user.last_name}`.trim();

  return (
    <Section spacing="default">
      <PageHeader
        title={t('pages.profile.title')}
        breadcrumbs={[
          { label: t('nav.account'), href: `/${locale}/account` },
          {
            label: t('pages.profile.title'),
            href: `/${locale}/account/profile`,
          },
        ]}
      />
      <Stack gap="6">
        <Card as="div" padding="lg">
          <Stack gap="4">
            <Inline gap="3" align="center">
              <span className={styles.sectionIcon} aria-hidden="true">
                <ImageIcon size={18} />
              </span>
              <h2 className={styles.sectionHeading}>
                {t('profile.sections.photo')}
              </h2>
            </Inline>
            <AvatarUploader
              name={fullName}
              userId={String(user.id)}
              src={user.avatar_url}
              isUploading={uploadAvatarMutation.isPending}
              onUpload={(file) => handleUploadAvatar(file)}
              onValidationError={(message) =>
                showToast(message, { variant: 'danger' })
              }
            />
          </Stack>
        </Card>
        <Card as="div" padding="lg">
          <Stack gap="4">
            <Inline gap="3" align="center">
              <span className={styles.sectionIcon} aria-hidden="true">
                <UserRound size={18} />
              </span>
              <h2 className={styles.sectionHeading}>
                {t('profile.sections.personalInfo')}
              </h2>
            </Inline>
            <ProfileForm
              user={user}
              onSave={(fields) => handleSaveProfile(fields)}
            />
          </Stack>
        </Card>
      </Stack>
    </Section>
  );
}
