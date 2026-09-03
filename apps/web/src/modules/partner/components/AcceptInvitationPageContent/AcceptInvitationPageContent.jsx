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
 *
 * 2026 public-frontend audit: visual pass only — every hook, mutation,
 * and conditional is unchanged; same token-preview/accept flow, same
 * expired-vs-not-found distinction (`INVITATION_EXPIRED` is the only
 * error code the backend ever returns distinctly — an already-used
 * invitation is indistinguishable from "not found" server-side, so no
 * separate visual state is invented for it; `notFoundDescription`'s
 * copy already covers both honestly), same email-mismatch handling. The
 * loading/error states stay a plain `Skeleton`/`ErrorState` (no personal
 * data exists yet to put in a hero); once the invitation preview loads,
 * the accept card gets the same `EditorialPageHero` shell
 * `PartnerApplicationPageContent`/`Become a Partner` use, personalized
 * with the real inviting partner's name — the one piece of "progress"
 * this single-step flow actually has.
 *
 * 2026 SEO audit: this route's own token is a real secret (single-use,
 * addressed to one invitee) — `robots.txt` already disallows crawling
 * anything under `/partner` (see `buildSitemap.mjs`), but that alone is
 * only a crawl-budget courtesy, not indexation protection (a crawler
 * that ignores robots.txt, or a URL discovered via a shared link rather
 * than a crawl, isn't stopped by it). `useNoIndex()` is the same explicit
 * per-page `noindex,nofollow` meta tag every other private/token-bearing
 * route in this app already carries — this route was the one page in its
 * own `partner/apply` route group missing it.
 */

import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import { Handshake } from 'lucide-react';
import { Button, Card } from '@desavii/ui/components/primitives';
import { Container } from '@desavii/ui/components/layout';
import { ErrorState, Skeleton } from '@desavii/ui/components/feedback-overlays';
import EditorialPageHero from '../../../../components/EditorialPageHero/EditorialPageHero.jsx';
import { useAuth } from '../../../../contexts/AuthContext.jsx';
import { useToast } from '../../../../contexts/ToastContext.jsx';
import useNoIndex from '../../../../seo/useNoIndex.js';
import { useInvitationPreviewQuery } from '../../queries/useInvitationPreviewQuery.js';
import { useAcceptInvitationMutation } from '../../mutations/useAcceptInvitationMutation.js';
import styles from './AcceptInvitationPageContent.module.scss';

export default function AcceptInvitationPageContent() {
  const { t } = useTranslation();
  const { locale, token } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { user, refreshUser } = useAuth();
  useNoIndex();

  const previewQuery = useInvitationPreviewQuery(token);
  const acceptMutation = useAcceptInvitationMutation();

  if (previewQuery.isPending) {
    return (
      <Container size="narrow" className={styles.page}>
        <Skeleton variant="text" width="60%" />
      </Container>
    );
  }

  if (previewQuery.isError) {
    const isExpired = previewQuery.error?.code === 'INVITATION_EXPIRED';
    return (
      <Container size="narrow" className={styles.page}>
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
      </Container>
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

  const breadcrumbs = [{ label: t('nav.home'), href: `/${locale}` }];
  const heading = t('partner.acceptInvitation.heading', {
    partnerName: preview.partner_name,
  });

  return (
    <Container size="narrow" className={styles.page}>
      <EditorialPageHero
        breadcrumbItems={breadcrumbs}
        heroSeed={preview.partner_name}
        icon={Handshake}
        title={heading}
        lead={t('partner.acceptInvitation.description', {
          partnerName: preview.partner_name,
          roleName: preview.role_name,
        })}
      />
      <Card padding="lg" elevated className={styles.actionCard}>
        {emailMismatch ? (
          <p className={styles.mismatch}>
            {t('partner.acceptInvitation.emailMismatch', {
              invitedEmail: preview.email,
            })}
          </p>
        ) : (
          <Button
            variant="primary"
            size="lg"
            loading={acceptMutation.isPending}
            onClick={() => handleAccept()}
          >
            {t('partner.acceptInvitation.acceptAction')}
          </Button>
        )}
      </Card>
    </Container>
  );
}
