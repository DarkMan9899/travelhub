/**
 * AcceptInvitationPageContent — `/:locale/partner/invitations/:token`
 * (P1.4, Master Roadmap). Reached either directly from the invitation
 * email, or bounced back here by `RequireAuth` after a sign-in/register
 * detour (`RegisterForm.jsx`/`LoginForm.jsx` both honor `?redirect=`).
 *
 * Deliberately outside `RequirePartner` — the visitor has no
 * `partner_employees` row yet, that's the whole point of this page.
 * `RequireAuth` alone gates the route (same group `partner/apply`
 * already uses).
 */

import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Card } from '@desavii/ui/components/primitives';
import { ErrorState, Skeleton } from '@desavii/ui/components/feedback-overlays';
import { Section, Stack } from '@desavii/ui/components/layout';
import { useAuth } from '../../../../contexts/AuthContext.jsx';
import { useToast } from '../../../../contexts/ToastContext.jsx';
import { useInvitationPreviewQuery } from '../../queries/useInvitationPreviewQuery.js';
import { useAcceptInvitationMutation } from '../../mutations/useAcceptInvitationMutation.js';

export default function AcceptInvitationPageContent() {
  const { t } = useTranslation();
  const { locale, token } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { user, refreshUser } = useAuth();

  const previewQuery = useInvitationPreviewQuery(token);
  const acceptMutation = useAcceptInvitationMutation();

  if (previewQuery.isPending) {
    return (
      <Section spacing="default">
        <Skeleton variant="text" width="60%" />
      </Section>
    );
  }

  if (previewQuery.isError) {
    const isExpired = previewQuery.error?.code === 'INVITATION_EXPIRED';
    return (
      <Section spacing="default">
        <ErrorState
          title={t(
            isExpired
              ? 'partner.acceptInvitation.expiredTitle'
              : 'partner.acceptInvitation.notFoundTitle',
          )}
          description={t(
            isExpired
              ? 'partner.acceptInvitation.expiredDescription'
              : 'partner.acceptInvitation.notFoundDescription',
          )}
        />
      </Section>
    );
  }

  const preview = previewQuery.data;
  const emailMismatch =
    user && user.email.toLowerCase() !== preview.email.toLowerCase();

  async function handleAccept() {
    try {
      await acceptMutation.mutateAsync(token);
      await refreshUser();
      showToast(t('partner.acceptInvitation.success'), { variant: 'success' });
      navigate(`/${locale}/partner`, { replace: true });
    } catch {
      showToast(t('partner.acceptInvitation.error'), { variant: 'danger' });
    }
  }

  return (
    <Section spacing="default">
      <Card padding="lg">
        <Stack gap="4">
          <h1>
            {t('partner.acceptInvitation.heading', {
              partnerName: preview.partner_name,
            })}
          </h1>
          <p>
            {t('partner.acceptInvitation.description', {
              partnerName: preview.partner_name,
              roleName: preview.role_name,
            })}
          </p>

          {emailMismatch ? (
            <p>
              {t('partner.acceptInvitation.emailMismatch', {
                invitedEmail: preview.email,
              })}
            </p>
          ) : (
            <Button
              variant="primary"
              loading={acceptMutation.isPending}
              onClick={() => handleAccept()}
            >
              {t('partner.acceptInvitation.acceptAction')}
            </Button>
          )}
        </Stack>
      </Card>
    </Section>
  );
}
