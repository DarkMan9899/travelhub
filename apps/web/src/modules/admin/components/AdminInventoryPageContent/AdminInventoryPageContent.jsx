/**
 * AdminInventoryPageContent — `/:locale/admin/inventory` (Phase 17 §31:
 * "Admin tooling to answer 'why is this unavailable' without touching
 * the database directly").
 *
 * Admin/Support enters a listing id, sees its bookable units (resources),
 * picks one, and gets the same diagnostic surface a partner sees on
 * their own Calendar page — a rolling 14-day breakdown
 * (total/available/confirmed/held/external/manual per day), the
 * append-only inventory ledger, and read-only lists of active manual
 * blocks / external reservations / connections — with zero write
 * affordances (this is oversight, not partner self-service; a partner's
 * own Calendar page is still where blocks/reservations are created).
 *
 * Every read here goes through the exact same `AvailabilityService`
 * methods the partner UI calls (`getAvailabilityBreakdown`,
 * `getInventoryLedger`, `listManualBlocks`, `listExternalReservations`,
 * `listConnections`) — each already accepts the `inventory.view_all`
 * permission as an Admin/Support override alongside partner ownership
 * (Phase 17 spec §40), so no new backend endpoint was needed, only this
 * page. Listing/unit lookup reuses the existing PUBLIC
 * `GET /listings/:id` + `GET /availability/:listingId/units` reads (the
 * same ones the customer-facing Listing Detail page uses) — the one
 * honest limitation this implies is that an unpublished/draft listing
 * isn't searchable here yet, since those endpoints don't expose one.
 */

import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { Section, Stack, Inline } from '@desavii/ui/components/layout';
import { Input } from '@desavii/ui/components/form-controls';
import { Button, Card, Badge } from '@desavii/ui/components/primitives';
import {
  Spinner,
  EmptyState,
  ErrorState,
} from '@desavii/ui/components/feedback-overlays';
import { DataTable } from '@desavii/ui/components/dashboard';
import { Tabs } from '@desavii/ui/components/navigation';
import { Search } from 'lucide-react';
import PageHeader from '../../../../components/PageHeader/PageHeader.jsx';
import {
  useListingQuery,
  useListingBookableUnitsQuery,
} from '../../../listings/index.js';
import {
  useUnitBreakdownQuery,
  useUnitLedgerQuery,
  useUnitHoldsQuery,
  useInventoryBlocksQuery,
  useExternalReservationsQuery,
  useInventoryConnectionsQuery,
  useConnectionSyncRunsQuery,
  useConnectionConflictsQuery,
  BOOKABLE_UNIT_TYPES,
} from '../../../availability/index.js';

function pad2(value) {
  return String(value).padStart(2, '0');
}

function toDateString(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function rollingWindow(days = 14) {
  const from = new Date();
  const to = new Date();
  to.setDate(to.getDate() + days - 1);
  return { from: toDateString(from), to: toDateString(to) };
}

function unitLabel(unit, t) {
  if (unit.unit_label) return unit.unit_label;
  if (unit.time_slot_start) return unit.time_slot_start.slice(0, 5);
  return BOOKABLE_UNIT_TYPES.includes(unit.bookable_unit_type)
    ? t(`partner.listingWizard.bookableUnitTypes.${unit.bookable_unit_type}`)
    : unit.bookable_unit_type;
}

export default function AdminInventoryPageContent() {
  const { t } = useTranslation();
  const { locale } = useParams();

  const [listingIdInput, setListingIdInput] = useState('');
  const [lookupListingId, setLookupListingId] = useState(null);
  const [unitId, setUnitId] = useState(null);
  const [detailTab, setDetailTab] = useState('breakdown');
  const [selectedConnectionId, setSelectedConnectionId] = useState(null);

  const { from, to } = useMemo(() => rollingWindow(14), []);

  const listingQuery = useListingQuery(lookupListingId);
  const unitsQuery = useListingBookableUnitsQuery(lookupListingId);
  const units = unitsQuery.data ?? [];
  const effectiveUnitId = unitId ?? units[0]?.id ?? null;

  const breakdownQuery = useUnitBreakdownQuery(effectiveUnitId, from, to);
  const ledgerQuery = useUnitLedgerQuery(effectiveUnitId, from, to);
  const holdsQuery = useUnitHoldsQuery(effectiveUnitId, from, to);
  const blocksQuery = useInventoryBlocksQuery(lookupListingId);
  const externalQuery = useExternalReservationsQuery(lookupListingId);
  const connectionsQuery = useInventoryConnectionsQuery(
    listingQuery.data?.partner_id,
  );
  const syncRunsQuery = useConnectionSyncRunsQuery(selectedConnectionId, {
    enabled: Boolean(selectedConnectionId),
  });
  const conflictsQuery = useConnectionConflictsQuery(selectedConnectionId, {
    enabled: Boolean(selectedConnectionId),
  });

  const activeBlocksForUnit = (blocksQuery.data ?? []).filter(
    (b) => b.bookable_unit_id === effectiveUnitId && !b.released_at,
  );
  const activeExternalForUnit = (externalQuery.data ?? []).filter(
    (r) => r.bookable_unit_id === effectiveUnitId && !r.cancelled_at,
  );

  function handleLookup() {
    const parsed = Number(listingIdInput);
    if (Number.isInteger(parsed) && parsed > 0) {
      setLookupListingId(parsed);
      setUnitId(null);
    }
  }

  const breakdownColumns = [
    { key: 'date', header: t('admin.inventory.breakdown.columns.date') },
    { key: 'total', header: t('admin.inventory.breakdown.columns.total') },
    {
      key: 'available',
      header: t('admin.inventory.breakdown.columns.available'),
    },
    {
      key: 'confirmed',
      header: t('admin.inventory.breakdown.columns.confirmed'),
    },
    { key: 'held', header: t('admin.inventory.breakdown.columns.held') },
    {
      key: 'external',
      header: t('admin.inventory.breakdown.columns.external'),
    },
    { key: 'manual', header: t('admin.inventory.breakdown.columns.manual') },
  ];

  const ledgerColumns = [
    { key: 'date', header: t('admin.inventory.ledger.columns.date') },
    {
      key: 'source_type',
      header: t('admin.inventory.ledger.columns.source'),
      render: (row) =>
        t(`admin.inventory.ledger.sourceTypes.${row.source_type}`, {
          defaultValue: row.source_type,
        }),
    },
    { key: 'delta', header: t('admin.inventory.ledger.columns.delta') },
    {
      key: 'quantity',
      header: t('admin.inventory.ledger.columns.quantity'),
      render: (row) => `${row.quantity_before} → ${row.quantity_after}`,
    },
    { key: 'reason', header: t('admin.inventory.ledger.columns.reason') },
    {
      key: 'created_at',
      header: t('admin.inventory.ledger.columns.createdAt'),
      render: (row) => new Date(row.created_at).toLocaleString(locale),
    },
  ];

  const blockColumns = [
    {
      key: 'range',
      header: t('admin.inventory.blocks.columns.range'),
      render: (row) => `${row.date_from} – ${row.date_to}`,
    },
    { key: 'quantity', header: t('admin.inventory.blocks.columns.quantity') },
    {
      key: 'reason',
      header: t('admin.inventory.blocks.columns.reason'),
      render: (row) =>
        t(`partner.calendar.blocks.reasonCodes.${row.reason_code}`),
    },
  ];

  const externalColumns = [
    {
      key: 'range',
      header: t('admin.inventory.external.columns.range'),
      render: (row) => `${row.date_from} – ${row.date_to}`,
    },
    {
      key: 'source',
      header: t('admin.inventory.external.columns.source'),
      render: (row) =>
        t(`partner.calendar.external.sourceCodes.${row.source_code}`),
    },
    {
      key: 'guest',
      header: t('admin.inventory.external.columns.guest'),
      render: (row) => row.guest_name || '—',
    },
  ];

  const connectionColumns = [
    { key: 'name', header: t('admin.inventory.connections.columns.name') },
    {
      key: 'type',
      header: t('admin.inventory.connections.columns.type'),
      render: (row) =>
        t(`partner.connections.connectorTypes.${row.connector_type}`, {
          defaultValue: row.connector_type,
        }),
    },
    {
      key: 'status',
      header: t('admin.inventory.connections.columns.status'),
      render: (row) => (
        <Badge
          variant={row.status === 'ACTIVE' ? 'success' : 'danger'}
          label={t(`admin.inventory.connections.statuses.${row.status}`, {
            defaultValue: row.status,
          })}
        />
      ),
    },
    {
      key: 'lastSync',
      header: t('admin.inventory.connections.columns.lastSync'),
      render: (row) =>
        row.last_successful_sync_at
          ? new Date(row.last_successful_sync_at).toLocaleString(locale)
          : t('admin.inventory.connections.neverSynced'),
    },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSelectedConnectionId(row.id)}
        >
          {t('admin.inventory.connections.detailsAction')}
        </Button>
      ),
    },
  ];

  const holdColumns = [
    {
      key: 'range',
      header: t('admin.inventory.holds.columns.range'),
      render: (row) => `${row.date_from} – ${row.date_to}`,
    },
    { key: 'user_id', header: t('admin.inventory.holds.columns.user') },
    {
      key: 'expires_at',
      header: t('admin.inventory.holds.columns.expiresAt'),
      render: (row) => new Date(row.expires_at).toLocaleString(locale),
    },
  ];

  const syncRunColumns = [
    {
      key: 'started_at',
      header: t('admin.inventory.syncRuns.columns.startedAt'),
      render: (row) => new Date(row.started_at).toLocaleString(locale),
    },
    {
      key: 'trigger_code',
      header: t('admin.inventory.syncRuns.columns.trigger'),
      render: (row) =>
        t(`partner.connections.syncTriggers.${row.trigger_code}`, {
          defaultValue: row.trigger_code,
        }),
    },
    {
      key: 'status',
      header: t('admin.inventory.syncRuns.columns.status'),
      render: (row) => (
        <Badge
          variant={row.status === 'FAILED' ? 'danger' : 'success'}
          label={t(`partner.connections.syncStatuses.${row.status}`, {
            defaultValue: row.status,
          })}
        />
      ),
    },
    {
      key: 'records',
      header: t('admin.inventory.syncRuns.columns.records'),
      render: (row) =>
        t('admin.inventory.syncRuns.recordsSummary', {
          created: row.records_created ?? 0,
          skipped: row.records_skipped ?? 0,
        }),
    },
    {
      key: 'error_message',
      header: t('admin.inventory.syncRuns.columns.error'),
      render: (row) => row.error_message || '—',
    },
  ];

  const conflictColumns = [
    {
      key: 'external_event_uid',
      header: t('admin.inventory.conflicts.columns.event'),
      render: (row) => row.external_event_uid || '—',
    },
    {
      key: 'conflict_type',
      header: t('admin.inventory.conflicts.columns.type'),
      render: (row) =>
        t(`partner.connections.conflictTypes.${row.conflict_type}`, {
          defaultValue: row.conflict_type,
        }),
    },
    {
      key: 'created_at',
      header: t('admin.inventory.conflicts.columns.createdAt'),
      render: (row) => new Date(row.created_at).toLocaleString(locale),
    },
  ];

  return (
    <Section spacing="default">
      <PageHeader
        title={t('admin.inventory.heading')}
        breadcrumbs={[
          { label: t('admin.nav.dashboard'), href: `/${locale}/admin` },
          {
            label: t('admin.inventory.heading'),
            href: `/${locale}/admin/inventory`,
          },
        ]}
      />
      <p>{t('admin.inventory.description')}</p>

      <Card as="div" padding="lg">
        <Inline gap="3" align="flex-end" wrap>
          <Input
            label={t('admin.inventory.lookup.label')}
            type="number"
            value={listingIdInput}
            onChange={(event) => setListingIdInput(event.target.value)}
            placeholder={t('admin.inventory.lookup.placeholder')}
          />
          <Button
            variant="primary"
            onClick={() => handleLookup()}
            disabled={!listingIdInput}
          >
            <Search size={16} aria-hidden="true" />
            {t('admin.inventory.lookup.action')}
          </Button>
        </Inline>
      </Card>

      {!lookupListingId && (
        <EmptyState
          title={t('admin.inventory.noLookup.title')}
          description={t('admin.inventory.noLookup.description')}
        />
      )}

      {lookupListingId && listingQuery.isPending && (
        <Spinner label={t('admin.inventory.heading')} />
      )}

      {lookupListingId && listingQuery.isError && (
        <ErrorState
          title={t('admin.inventory.notFound.title')}
          description={t('admin.inventory.notFound.description')}
        />
      )}

      {lookupListingId && listingQuery.data && (
        <Stack gap="4">
          <Card as="div" padding="lg">
            <Stack gap="3">
              <h2>{listingQuery.data.title}</h2>
              {units.length > 1 && (
                // `aria-pressed` on each button is the "toggle button
                // group" pattern, not tabs — see the identical fix in
                // `PartnerCalendarPageContent.jsx` (`role="tablist"`
                // required `role="tab"` children, a real critical axe
                // violation; `role="group"` matches what this actually is).
                <Inline
                  gap="2"
                  wrap
                  role="group"
                  aria-label={t('partner.calendar.resourceLabel')}
                >
                  {units.map((unit) => (
                    <Button
                      key={unit.id}
                      variant={
                        unit.id === effectiveUnitId ? 'primary' : 'secondary'
                      }
                      size="sm"
                      aria-pressed={unit.id === effectiveUnitId}
                      onClick={() => setUnitId(unit.id)}
                    >
                      {unitLabel(unit, t)}
                    </Button>
                  ))}
                </Inline>
              )}
            </Stack>
          </Card>

          {!unitsQuery.isPending && units.length === 0 && (
            <EmptyState
              title={t('admin.inventory.noUnits.title')}
              description={t('admin.inventory.noUnits.description')}
            />
          )}

          {effectiveUnitId && (
            <Card as="div" padding="lg">
              <Tabs
                ariaLabel={t('admin.inventory.detailTabsLabel')}
                activeTabId={detailTab}
                onChange={setDetailTab}
                tabs={[
                  {
                    id: 'breakdown',
                    label: t('admin.inventory.breakdown.tabLabel'),
                    panel: (
                      <DataTable
                        columns={breakdownColumns}
                        rows={breakdownQuery.data ?? []}
                        isLoading={breakdownQuery.isPending}
                        emptyTitle={t('admin.inventory.breakdown.emptyTitle')}
                      />
                    ),
                  },
                  {
                    id: 'holds',
                    label: t('admin.inventory.holds.tabLabel', {
                      count: (holdsQuery.data ?? []).length,
                    }),
                    panel: (
                      <DataTable
                        columns={holdColumns}
                        rows={holdsQuery.data ?? []}
                        isLoading={holdsQuery.isPending}
                        emptyTitle={t('admin.inventory.holds.emptyTitle')}
                      />
                    ),
                  },
                  {
                    id: 'ledger',
                    label: t('admin.inventory.ledger.tabLabel'),
                    panel: (
                      <DataTable
                        columns={ledgerColumns}
                        rows={ledgerQuery.data ?? []}
                        isLoading={ledgerQuery.isPending}
                        emptyTitle={t('admin.inventory.ledger.emptyTitle')}
                      />
                    ),
                  },
                  {
                    id: 'blocks',
                    label: t('admin.inventory.blocks.tabLabel', {
                      count: activeBlocksForUnit.length,
                    }),
                    panel: (
                      <DataTable
                        columns={blockColumns}
                        rows={activeBlocksForUnit}
                        isLoading={blocksQuery.isPending}
                        emptyTitle={t('admin.inventory.blocks.emptyTitle')}
                      />
                    ),
                  },
                  {
                    id: 'external',
                    label: t('admin.inventory.external.tabLabel', {
                      count: activeExternalForUnit.length,
                    }),
                    panel: (
                      <DataTable
                        columns={externalColumns}
                        rows={activeExternalForUnit}
                        isLoading={externalQuery.isPending}
                        emptyTitle={t('admin.inventory.external.emptyTitle')}
                      />
                    ),
                  },
                  {
                    id: 'connections',
                    label: t('admin.inventory.connections.tabLabel'),
                    panel: (
                      <DataTable
                        columns={connectionColumns}
                        rows={connectionsQuery.data ?? []}
                        isLoading={connectionsQuery.isPending}
                        emptyTitle={t('admin.inventory.connections.emptyTitle')}
                      />
                    ),
                  },
                  {
                    id: 'syncRuns',
                    label: t('admin.inventory.syncRuns.tabLabel'),
                    panel: selectedConnectionId ? (
                      <DataTable
                        columns={syncRunColumns}
                        rows={syncRunsQuery.data ?? []}
                        isLoading={syncRunsQuery.isPending}
                        emptyTitle={t('admin.inventory.syncRuns.emptyTitle')}
                      />
                    ) : (
                      <EmptyState
                        title={t('admin.inventory.syncRuns.noSelectionTitle')}
                        description={t(
                          'admin.inventory.syncRuns.noSelectionDescription',
                        )}
                      />
                    ),
                  },
                  {
                    id: 'conflicts',
                    label: t('admin.inventory.conflicts.tabLabel'),
                    panel: selectedConnectionId ? (
                      <DataTable
                        columns={conflictColumns}
                        rows={conflictsQuery.data ?? []}
                        isLoading={conflictsQuery.isPending}
                        emptyTitle={t('admin.inventory.conflicts.emptyTitle')}
                      />
                    ) : (
                      <EmptyState
                        title={t('admin.inventory.conflicts.noSelectionTitle')}
                        description={t(
                          'admin.inventory.conflicts.noSelectionDescription',
                        )}
                      />
                    ),
                  },
                ]}
              />
            </Card>
          )}
        </Stack>
      )}
    </Section>
  );
}
