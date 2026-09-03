/**
 * PartnerWorkspaceIdentity — 2026 Partner Workspace redesign: the
 * workspace-identity block above the Partner nav (`PartnerLayout`'s own
 * sidebar column), mirroring where `AccountIdentityCard` sits in
 * `CustomerAccountLayout` but deliberately NOT sharing that component —
 * this shows the COMPANY (`activePartner`/company profile), not the
 * signed-in user, and Partner Workspace's brief calls for a restrained,
 * navy operational anchor rather than Customer Account's white
 * soft-elevation "premium" card, so the two need different markup and
 * styling, not a shared component with a variant prop.
 *
 * `activePartner` (from `usePartnerContext`, ultimately `GET
 * /partners/mine` via `AuthContext.partnerships` — verified against
 * `toPartnershipResponse`, `apps/api/src/modules/partners/dto/
 * partnerDto.js`) carries `{ partner_id, slug, display_name, role,
 * verification_status }` — snake_case wire shape, NOT the repository's
 * internal camelCase domain-object naming. `logo_url` isn't part of that
 * membership summary (`listMembershipsForUser` never selects it), so
 * this reads it from `useMyCompanyProfileQuery` instead — the same hook
 * `PartnerProfilePageContent` already uses (`toPartnerDetailResponse`,
 * also snake_case: `logo_url`, `is_verified`). React Query dedupes/
 * shares that cache entry, so mounting it here too is not a second real
 * network round trip once the Profile page has ever been visited; on
 * first load the avatar just starts as CompanyAvatar's initials
 * fallback and swaps to the real logo once it resolves.
 */

import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { ShieldCheck } from 'lucide-react';
import CompanyAvatar from '../../../../components/CompanyAvatar/CompanyAvatar.jsx';
import RouterLink from '../../../../components/RouterLink.jsx';
import { useMyCompanyProfileQuery } from '../../queries/useMyCompanyProfileQuery.js';
import styles from './PartnerWorkspaceIdentity.module.scss';

export default function PartnerWorkspaceIdentity({ activePartner, locale }) {
  const { t } = useTranslation();
  const { data: profile } = useMyCompanyProfileQuery(activePartner.partner_id);
  const isVerified =
    profile?.is_verified ?? activePartner.verification_status === 'APPROVED';

  return (
    <RouterLink href={`/${locale}/partner/profile`} className={styles.card}>
      <CompanyAvatar
        name={activePartner.display_name}
        logoUrl={profile?.logo_url}
        seed={activePartner.partner_id}
        size={36}
      />
      <span className={styles.text}>
        <span className={styles.name}>{activePartner.display_name}</span>
        <span className={styles.meta}>
          {t(`partner.staff.roles.${activePartner.role}`, {
            defaultValue: activePartner.role,
          })}
          {isVerified && (
            <span className={styles.verified}>
              <ShieldCheck size={13} aria-hidden="true" />
              {t('companies.card.verified')}
            </span>
          )}
        </span>
      </span>
    </RouterLink>
  );
}

PartnerWorkspaceIdentity.propTypes = {
  activePartner: PropTypes.shape({
    partner_id: PropTypes.oneOfType([PropTypes.number, PropTypes.string])
      .isRequired,
    display_name: PropTypes.string.isRequired,
    role: PropTypes.string,
    verification_status: PropTypes.string,
  }).isRequired,
  locale: PropTypes.string.isRequired,
};
