/**
 * P2.2B — compact, read-only bed-configuration summary for the customer-
 * facing `ListingReservationWidget` unit selector. Reuses the exact same
 * `partner.listingWizard.availability.bedSummaryItem` /
 * `partner.listingWizard.bedTypes.*` translation keys the partner-side
 * `BookableUnitsManager` already uses to render this same
 * `bed_configuration` shape (`[{type, count}]`) — no new frontend-only
 * copy invented for data that already has a real, translated
 * representation.
 */

export function formatBedConfiguration(t, bedConfiguration) {
  if (!bedConfiguration || bedConfiguration.length === 0) return null;
  return bedConfiguration
    .map((row) =>
      t('partner.listingWizard.availability.bedSummaryItem', {
        count: row.count,
        type: t(`partner.listingWizard.bedTypes.${row.type}`, row.type),
      }),
    )
    .join(', ');
}

export default { formatBedConfiguration };
