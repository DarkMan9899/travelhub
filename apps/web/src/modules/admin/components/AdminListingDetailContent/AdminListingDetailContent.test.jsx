import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ToastProvider from '../../../../providers/ToastProvider.jsx';
import ConfirmProvider from '../../../../providers/ConfirmProvider.jsx';
import AdminListingDetailContent from './AdminListingDetailContent.jsx';
import { useAdminListingDetailQuery } from '../../queries/useAdminListingDetailQuery.js';
import { useAdminPartnerDetailQuery } from '../../queries/useAdminPartnerDetailQuery.js';
import { useAdminAuditLogsQuery } from '../../queries/useAdminAuditLogsQuery.js';
import { useUpdateListingModerationStatusMutation } from '../../mutations/useUpdateListingModerationStatusMutation.js';
import { useAuth } from '../../../../contexts/AuthContext.jsx';
import * as listingsModule from '../../../listings/index.js';

vi.mock('../../queries/useAdminListingDetailQuery.js', () => ({
  useAdminListingDetailQuery: vi.fn(),
}));
vi.mock('../../queries/useAdminPartnerDetailQuery.js', () => ({
  useAdminPartnerDetailQuery: vi.fn(),
}));
vi.mock('../../queries/useAdminAuditLogsQuery.js', () => ({
  useAdminAuditLogsQuery: vi.fn(),
}));
vi.mock('../../mutations/useUpdateListingModerationStatusMutation.js', () => ({
  useUpdateListingModerationStatusMutation: vi.fn(),
}));
vi.mock('../../../../contexts/AuthContext.jsx', () => ({ useAuth: vi.fn() }));

// Real barrel, except the network-backed queries (bookable units,
// category metadata/list) — every other export (AuthoringLocaleTabs,
// getLocalizedItemsExact, the shared Listing*Section components,
// ListingStatusBadge) stays real so this test exercises the actual
// "no silent fallback" locale-review logic, not a mocked stand-in for
// it.
vi.mock('../../../listings/index.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useListingBookableUnitsQuery: vi.fn(),
    useListingMetadataQuery: vi.fn(),
    useListingCategoriesQuery: vi.fn(),
  };
});

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/hy/admin/listings/1']}>
      <ToastProvider>
        <ConfirmProvider>
          <Routes>
            <Route
              path="/:locale/admin/listings/:id"
              element={<AdminListingDetailContent />}
            />
          </Routes>
        </ConfirmProvider>
      </ToastProvider>
    </MemoryRouter>,
  );
}

const BASE_LISTING = {
  id: 1,
  partner_id: 5,
  listing_type: 'HOTEL',
  slug: 'yerevan-boutique-hotel',
  status: 'PENDING_REVIEW',
  moderation_status: 'PENDING',
  moderation_notes: null,
  category_ids: [],
  amenity_ids: [],
  attribute_values: [],
  policy_values: [],
  media: [],
  pricing: null,
  location: null,
  translations: [
    {
      language_code: 'hy',
      title: 'Yerevan Boutique Hotel',
      summary: 'A boutique stay in the city center.',
      description: 'Full Armenian description of the property.',
    },
  ],
  highlights: [],
  itinerary_steps: [],
  included_items: [],
  faqs: [],
};

describe('AdminListingDetailContent (apps/web/src/modules/admin)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAdminPartnerDetailQuery.mockReturnValue({
      data: { id: 5, display_name: 'Yerevan Boutique Hospitality' },
      isPending: false,
      isError: false,
    });
    listingsModule.useListingBookableUnitsQuery.mockReturnValue({
      data: [],
      isPending: false,
    });
    listingsModule.useListingMetadataQuery.mockReturnValue({
      data: undefined,
      isPending: false,
    });
    listingsModule.useListingCategoriesQuery.mockReturnValue({
      data: [],
      isPending: false,
    });
    useUpdateListingModerationStatusMutation.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
      variables: undefined,
    });
  });

  test('shows a retryable error state', () => {
    const refetch = vi.fn();
    useAuth.mockReturnValue({ permissions: ['listing.moderate'] });
    useAdminListingDetailQuery.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
      refetch,
    });
    renderPage();

    expect(
      screen.getByText('Հայտարարությունները բեռնելիս սխալ առաջացավ։'),
    ).toBeInTheDocument();
  });

  test('renders identity fields and defaults the locale review tab to the admin’s own locale', () => {
    useAuth.mockReturnValue({ permissions: ['listing.moderate'] });
    useAdminListingDetailQuery.mockReturnValue({
      data: BASE_LISTING,
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    });

    renderPage();

    expect(
      screen.getByRole('heading', { name: 'Yerevan Boutique Hotel' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Հայերեն/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(
      screen.getByText('Full Armenian description of the property.'),
    ).toBeInTheDocument();
  });

  test('a locale with no authored translation shows a "not translated" notice instead of falling back to another locale', async () => {
    const user = userEvent.setup();
    useAuth.mockReturnValue({ permissions: ['listing.moderate'] });
    useAdminListingDetailQuery.mockReturnValue({
      data: BASE_LISTING,
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    });

    renderPage();

    // Only Armenian was authored — English must show "not translated",
    // never the Armenian content silently standing in for it (the real
    // bug this redesign fixes).
    await user.click(screen.getByRole('tab', { name: /English/ }));

    expect(screen.getByText('Չի թարգմանվել')).toBeInTheDocument();
    expect(
      screen.queryByText('Full Armenian description of the property.'),
    ).not.toBeInTheDocument();
  });

  test('moderation history is shown only when the admin holds audit.view', () => {
    useAuth.mockReturnValue({
      permissions: ['listing.moderate', 'audit.view'],
    });
    useAdminListingDetailQuery.mockReturnValue({
      data: BASE_LISTING,
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    });
    useAdminAuditLogsQuery.mockReturnValue({
      data: {
        pages: [
          {
            results: [
              {
                id: 99,
                actor_name: 'Dev Admin',
                created_at: '2026-08-01T10:00:00.000Z',
                before_snapshot: { moderationStatusCode: 'PENDING' },
                after_snapshot: {
                  moderationStatusCode: 'APPROVED',
                  notes: null,
                },
              },
            ],
          },
        ],
      },
      isPending: false,
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
    });

    renderPage();

    expect(screen.getByText('Մոդերացիայի պատմություն')).toBeInTheDocument();
  });

  test('moderation history is omitted (not a broken/empty section) when the admin lacks audit.view', () => {
    useAuth.mockReturnValue({ permissions: ['listing.moderate'] });
    useAdminListingDetailQuery.mockReturnValue({
      data: BASE_LISTING,
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    });

    renderPage();

    expect(
      screen.queryByText('Մոդերացիայի պատմություն'),
    ).not.toBeInTheDocument();
    expect(useAdminAuditLogsQuery).not.toHaveBeenCalled();
  });

  test('approve/reject actions are hidden without listing.moderate', () => {
    useAuth.mockReturnValue({ permissions: [] });
    useAdminListingDetailQuery.mockReturnValue({
      data: BASE_LISTING,
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    });

    renderPage();

    expect(
      screen.queryByRole('button', { name: 'Հաստատել' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Մերժել' }),
    ).not.toBeInTheDocument();
  });
});
