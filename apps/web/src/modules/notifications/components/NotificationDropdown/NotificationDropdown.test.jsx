import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import NotificationDropdown from './NotificationDropdown.jsx';
import {
  listNotifications,
  markAllNotificationsRead,
} from '../../../../api/notifications.js';

vi.mock('../../../../api/notifications.js', () => ({
  listNotifications: vi.fn(),
  markAllNotificationsRead: vi.fn(),
  markNotificationRead: vi.fn(),
  archiveNotification: vi.fn(),
  deleteNotification: vi.fn(),
}));

function renderDropdown() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/hy']}>
        <Routes>
          <Route path="/:locale" element={<NotificationDropdown />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const NOTIFICATION_ROW = {
  id: 1,
  event_type: 'favorite.added',
  category: 'FAVORITE',
  payload: {},
  is_read: false,
  is_archived: false,
  created_at: new Date().toISOString(),
};

describe('NotificationDropdown (apps/web/src/modules/notifications)', () => {
  beforeEach(() => {
    listNotifications.mockReset();
    markAllNotificationsRead.mockReset();
  });

  test('shows an empty state when there are no notifications', async () => {
    listNotifications.mockResolvedValue({
      data: [],
      meta: { has_more: false },
    });
    renderDropdown();
    expect(
      await screen.findByText('Ծանուցումներ դեռ չկան'),
    ).toBeInTheDocument();
  });

  test('renders a row per notification and a working "View all" link', async () => {
    listNotifications.mockResolvedValue({
      data: [NOTIFICATION_ROW],
      meta: { has_more: false },
    });
    renderDropdown();
    expect(await screen.findByText(/ընտրյալների/)).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Դիտել բոլոր ծանուցումները' }),
    ).toHaveAttribute('href', '/hy/account/notifications');
  });

  test('"Mark all as read" only appears when there is an unread notification, and calls the mutation', async () => {
    listNotifications.mockResolvedValue({
      data: [NOTIFICATION_ROW],
      meta: { has_more: false },
    });
    markAllNotificationsRead.mockResolvedValue({});
    renderDropdown();
    const user = userEvent.setup();

    const markAllButton = await screen.findByText('Նշել բոլորը որպես կարդացած');
    await user.click(markAllButton);

    await waitFor(() => expect(markAllNotificationsRead).toHaveBeenCalled());
  });

  test('shows a retryable error state when the request fails', async () => {
    listNotifications.mockRejectedValue(new Error('boom'));
    renderDropdown();
    expect(
      await screen.findByText('Չհաջողվեց բեռնել ծանուցումները'),
    ).toBeInTheDocument();
  });
});
