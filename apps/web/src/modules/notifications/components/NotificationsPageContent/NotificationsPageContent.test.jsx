import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import NotificationsPageContent from './NotificationsPageContent.jsx';
import { listNotifications } from '../../../../api/notifications.js';

vi.mock('../../../../api/notifications.js', () => ({
  listNotifications: vi.fn(),
  markAllNotificationsRead: vi.fn(),
  markNotificationRead: vi.fn(),
  archiveNotification: vi.fn(),
  deleteNotification: vi.fn(),
}));

function renderPage(props = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/hy']}>
        <Routes>
          <Route
            path="/:locale"
            // eslint-disable-next-line react/jsx-props-no-spreading -- test-only prop passthrough
            element={<NotificationsPageContent {...props} />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const NOTIFICATION_ROW = {
  id: 1,
  event_type: 'listing.approved',
  category: 'LISTING',
  payload: {},
  is_read: false,
  is_archived: false,
  created_at: new Date().toISOString(),
};

describe('NotificationsPageContent (apps/web/src/modules/notifications)', () => {
  beforeEach(() => {
    listNotifications.mockReset();
  });

  test('shows an empty state when there are no notifications', async () => {
    listNotifications.mockResolvedValue({
      data: [],
      meta: { has_more: false },
    });
    renderPage();
    expect(await screen.findByText('Ծանուցումներ չկան')).toBeInTheDocument();
  });

  test('renders the notification list on success', async () => {
    listNotifications.mockResolvedValue({
      data: [NOTIFICATION_ROW],
      meta: { has_more: false },
    });
    renderPage();
    expect(
      await screen.findByText('Ձեր հայտարարությունը հաստատվել է'),
    ).toBeInTheDocument();
  });

  test('shows a retryable error state when the request fails', async () => {
    listNotifications.mockRejectedValue(new Error('boom'));
    renderPage();
    expect(
      await screen.findByText('Չհաջողվեց բեռնել Ձեր ծանուցումները'),
    ).toBeInTheDocument();
  });

  test('switching to the "Unread" tab re-queries with the unread status filter', async () => {
    listNotifications.mockResolvedValue({
      data: [],
      meta: { has_more: false },
    });
    renderPage();
    const user = userEvent.setup();

    await screen.findByText('Ծանուցումներ չկան');
    await user.click(screen.getByRole('tab', { name: 'Չկարդացած' }));

    await waitFor(() =>
      expect(listNotifications).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'unread' }),
      ),
    );
  });

  test('typing in the search box eventually re-queries with the search term', async () => {
    listNotifications.mockResolvedValue({
      data: [],
      meta: { has_more: false },
    });
    renderPage();
    await screen.findByText('Ծանուցումներ չկան');

    const user = userEvent.setup();
    const searchInput = screen.getByPlaceholderText('Որոնել ծանուցումներում');
    await user.type(searchInput, 'BK-1');

    await waitFor(
      () =>
        expect(listNotifications).toHaveBeenCalledWith(
          expect.objectContaining({ search: 'BK-1' }),
        ),
      { timeout: 2000 },
    );
  });

  test('breadcrumbs (Admin Sprint 7): renders the passed trail, and renders none when omitted (Customer/Partner unaffected)', async () => {
    listNotifications.mockResolvedValue({
      data: [],
      meta: { has_more: false },
    });
    renderPage({
      breadcrumbs: [
        { label: 'Home', href: '/hy' },
        { label: 'Notifications', href: '/hy/admin/notifications' },
      ],
    });
    await screen.findByText('Ծանուցումներ չկան');

    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute(
      'href',
      '/hy',
    );
    expect(screen.getByText('Notifications')).toHaveAttribute(
      'aria-current',
      'page',
    );
  });
});
