import { describe, test, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import AdminDashboardOverviewContent from './AdminDashboardOverviewContent.jsx';
import { useAdminDashboardQuery } from '../../queries/useAdminDashboardQuery.js';

vi.mock('../../queries/useAdminDashboardQuery.js', () => ({
  useAdminDashboardQuery: vi.fn(),
}));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/hy/admin']}>
      <Routes>
        <Route
          path="/:locale/admin"
          element={<AdminDashboardOverviewContent />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('AdminDashboardOverviewContent (apps/web/src/modules/admin)', () => {
  test('shows the marketplace-overview heading', () => {
    useAdminDashboardQuery.mockReturnValue({
      data: undefined,
      isPending: true,
      isError: false,
      refetch: vi.fn(),
    });
    renderPage();
    expect(
      screen.getByRole('heading', { name: 'Շուկայի ընդհանուր տեսք' }),
    ).toBeInTheDocument();
  });

  test('shows a retryable error state on failure', async () => {
    const refetch = vi.fn();
    useAdminDashboardQuery.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
      refetch,
    });
    const user = userEvent.setup();
    renderPage();

    expect(
      screen.getByText('Վահանակը բեռնելիս ինչ-որ բան սխալ գնաց։'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Կրկին փորձել' }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  test('renders real counts, pending actions, booking value, and empty activity', () => {
    useAdminDashboardQuery.mockReturnValue({
      data: {
        counts: {
          users: 28,
          partners: 6,
          listings: 80,
          published_listings: 40,
          bookings: 152,
          completed_bookings: 32,
        },
        pending_actions: {
          pending_partners: 1,
          pending_listings: 8,
          pending_bookings: 40,
        },
        booking_value_by_currency: [{ currency_code: 'AMD', total: 500000 }],
        bookings_by_day: [{ day: '2026-07-30', total: 5 }],
        recent_activity: [],
      },
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    });
    renderPage();

    const usersLabel = screen.getByText('Օգտատերեր');
    expect(
      within(usersLabel.parentElement).getByText('28'),
    ).toBeInTheDocument();

    const partnersPendingLabel = screen.getByText(
      'Հաստատում սպասող գործընկերներ',
    );
    expect(
      within(partnersPendingLabel.parentElement).getByText('1'),
    ).toBeInTheDocument();

    expect(screen.getByText('AMD')).toBeInTheDocument();
    // Armenian (hy) Intl.NumberFormat uses a non-breaking space as the
    // thousands separator, not a comma — the test locale defaults to hy.
    expect(screen.getByText('500', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('Ակտիվություն դեռ չկա։')).toBeInTheDocument();
  });

  test('a pending-partners tile links straight into the filtered partner queue', () => {
    useAdminDashboardQuery.mockReturnValue({
      data: {
        counts: {},
        pending_actions: {
          pending_partners: 3,
          pending_listings: 0,
          pending_bookings: 0,
        },
        booking_value_by_currency: [],
        bookings_by_day: [],
        recent_activity: [],
      },
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    });
    renderPage();

    const link = screen.getByRole('link', {
      name: /3.*Հաստատում սպասող գործընկերներ/s,
    });
    expect(link).toHaveAttribute(
      'href',
      '/hy/admin/partners?verificationStatus=PENDING',
    );
  });

  test('recent activity renders a localized action/target label, never the raw audit-log codes', () => {
    useAdminDashboardQuery.mockReturnValue({
      data: {
        counts: {},
        pending_actions: {
          pending_partners: 0,
          pending_listings: 0,
          pending_bookings: 0,
        },
        booking_value_by_currency: [],
        bookings_by_day: [],
        recent_activity: [
          {
            actor_name: 'Dev Admin',
            action: 'user.status_changed',
            target_type: 'user',
            target_id: 7,
            created_at: '2026-09-04T10:00:00.000Z',
          },
          {
            actor_name: null,
            action: 'wallet.balance_adjusted',
            target_type: 'user',
            target_id: 3,
            created_at: '2026-09-04T09:00:00.000Z',
          },
        ],
      },
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    });
    renderPage();

    expect(
      screen.getByText(
        'Dev Admin — Փոխվել է օգտատիրոջ կարգավիճակը (Օգտատեր #7)',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/user\.status_changed/)).not.toBeInTheDocument();

    // An action added after this page's own translated catalog still
    // gets a humanized (never raw) fallback, and a null actor falls
    // back to "System" rather than rendering blank.
    expect(
      screen.getByText('Համակարգ — wallet: balance adjusted (Օգտատեր #3)'),
    ).toBeInTheDocument();
  });

  test('zero pending anything shows the all-caught-up state, not three zero tiles', () => {
    useAdminDashboardQuery.mockReturnValue({
      data: {
        counts: {},
        pending_actions: {
          pending_partners: 0,
          pending_listings: 0,
          pending_bookings: 0,
        },
        booking_value_by_currency: [],
        bookings_by_day: [],
        recent_activity: [],
      },
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    });
    renderPage();

    expect(
      screen.getByText(
        'Սպասող խնդիրներ չկան — ամեն ինչ վերահսկողության տակ է։',
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Հաստատում սպասող գործընկերներ'),
    ).not.toBeInTheDocument();
  });
});
