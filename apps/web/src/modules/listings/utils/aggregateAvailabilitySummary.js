/**
 * aggregateAvailabilitySummary — Phase 18 visual-polish fix. A listing
 * with several bookable units of the *same* type and no unit-level name
 * exposed to the public summary (e.g. a car-rental fleet: 3 interchangeable
 * `VEHICLE` units) previously rendered one `AvailabilitySummaryBadge` per
 * unit — three visually identical "Only 1 vehicles left" badges in a row,
 * which reads as a broken duplicate-render, not "three different
 * vehicles." `getPublicAvailabilitySummary` genuinely has no unit-name
 * field to distinguish them by (confirmed via `availabilityDto.js`), so
 * this is a purely presentational merge, not a business-logic change:
 * groups same-type units into one badge, using the most favorable status
 * among them (a customer only needs ONE bookable unit of that type) and
 * summing `remaining_count` across units that share that winning status.
 *
 * A listing whose units already differ by type (e.g. Standard Room +
 * Deluxe Suite) is unaffected — each type still gets its own badge.
 */

const STATUS_RANK = { AVAILABLE: 0, LOW: 1, SOLD_OUT: 2 };

export function aggregateAvailabilitySummaryByUnitType(summary) {
  const groups = new Map();
  summary.forEach((entry) => {
    const key = entry.bookable_unit_type;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(entry);
  });

  return [...groups.entries()].map(([unitType, entries]) => {
    const bestStatus = entries.reduce(
      (best, entry) =>
        STATUS_RANK[entry.availability_status] < STATUS_RANK[best]
          ? entry.availability_status
          : best,
      'SOLD_OUT',
    );
    const remainingSum = entries
      .filter((entry) => entry.availability_status === bestStatus)
      .reduce((sum, entry) => sum + (entry.remaining_count ?? 0), 0);
    return {
      unit_id: unitType,
      bookable_unit_type: unitType,
      availability_status: bestStatus,
      remaining_count: bestStatus === 'AVAILABLE' ? null : remainingSum,
    };
  });
}

export default aggregateAvailabilitySummaryByUnitType;
