/**
 * StaffMemberCard — 2026 Partner Workspace redesign (Sprint 4). The
 * mobile-only presentation of a `useStaffQuery` row — `PartnerStaffPageContent`
 * renders `DataTable` (desktop/tablet) and this card list (mobile) from
 * the exact same data/handlers, CSS-toggled by breakpoint (same pattern
 * `Sidebar` itself already uses for its own responsive reflow), so there
 * is exactly one source of truth for staff data and one set of
 * role-change/remove handlers — this component only ever renders what
 * `PartnerStaffPageContent` hands it.
 */

import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { Select } from '@desavii/ui/components/form-controls';
import { Button, Badge } from '@desavii/ui/components/primitives';
import { Stack, Inline } from '@desavii/ui/components/layout';
import styles from './StaffMemberCard.module.scss';

export default function StaffMemberCard({
  staff,
  assignableRoles,
  canManage,
  onRoleChange,
  onRemove,
}) {
  const { t } = useTranslation();
  const isOwner = staff.role === 'OWNER';

  return (
    <li className={styles.card}>
      <Stack gap="2">
        <Inline justify="space-between" align="center">
          <span className={styles.name}>
            {staff.first_name} {staff.last_name}
          </span>
          {isOwner && (
            <Badge
              variant="info"
              filled
              size="sm"
              label={t('partner.staff.roles.OWNER')}
            />
          )}
        </Inline>
        <span className={styles.email}>{staff.email}</span>

        {!isOwner && canManage && (
          <Select
            ariaLabel={t('partner.staff.table.role')}
            size="sm"
            options={assignableRoles.map((code) => ({
              value: code,
              label: t(`partner.staff.roles.${code}`),
            }))}
            value={staff.role}
            onChange={(roleCode) => onRoleChange(staff.id, roleCode)}
          />
        )}
        {!isOwner && !canManage && (
          <Badge
            variant="neutral"
            size="sm"
            label={t(`partner.staff.roles.${staff.role}`, {
              defaultValue: staff.role_name,
            })}
          />
        )}

        {!isOwner && canManage && (
          <Inline justify="flex-end">
            <Button variant="ghost" size="sm" onClick={() => onRemove(staff)}>
              {t('partner.staff.removeAction')}
            </Button>
          </Inline>
        )}
      </Stack>
    </li>
  );
}

StaffMemberCard.propTypes = {
  staff: PropTypes.shape({
    id: PropTypes.number.isRequired,
    first_name: PropTypes.string,
    last_name: PropTypes.string,
    email: PropTypes.string,
    role: PropTypes.string.isRequired,
    role_name: PropTypes.string,
  }).isRequired,
  assignableRoles: PropTypes.arrayOf(PropTypes.string).isRequired,
  canManage: PropTypes.bool.isRequired,
  onRoleChange: PropTypes.func.isRequired,
  onRemove: PropTypes.func.isRequired,
};
