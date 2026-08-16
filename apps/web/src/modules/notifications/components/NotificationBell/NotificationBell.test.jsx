import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import NotificationBell from './NotificationBell.jsx';
import { useAuth } from '../../../../contexts/AuthContext.jsx';
import {
  getUnreadCount,
  listNotifications,
} from '../../../../api/notifications.js';

vi.mock('../../../../contexts/AuthContext.jsx', () => ({ useAuth: vi.fn() }));
vi.mock('../../../../api/notifications.js', () => ({
  getUnreadCount: vi.fn(),
  listNotifications: vi.fn(),
  markAllNotificationsRead: vi.fn(),
  markNotificationRead: vi.fn(),
  archiveNotification: vi.fn(),
  deleteNotification: vi.fn(),
}));

function renderBell() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/hy']}>
        <Routes>
          <Route path="/:locale" element={<NotificationBell />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('NotificationBell (apps/web/src/modules/notifications)', () => {
  beforeEach(() => {
    getUnreadCount.mockReset();
    listNotifications.mockReset();
  });

  test('renders nothing for a logged-out visitor', () => {
    useAuth.mockReturnValue({ isAuthenticated: false, isBootstrapping: false });
    renderBell();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  test('shows an unread count badge when there are unread notifications', async () => {
    useAuth.mockReturnValue({ isAuthenticated: true, isBootstrapping: false });
    getUnreadCount.mockResolvedValue({ data: { unread_count: 3 } });
    renderBell();
    expect(await screen.findByText('3')).toBeInTheDocument();
  });

  test('caps the displayed badge at "9+"', async () => {
    useAuth.mockReturnValue({ isAuthenticated: true, isBootstrapping: false });
    getUnreadCount.mockResolvedValue({ data: { unread_count: 42 } });
    renderBell();
    expect(await screen.findByText('9+')).toBeInTheDocument();
  });

  test('shows no badge when there are zero unread notifications', async () => {
    useAuth.mockReturnValue({ isAuthenticated: true, isBootstrapping: false });
    getUnreadCount.mockResolvedValue({ data: { unread_count: 0 } });
    renderBell();
    await waitFor(() => expect(getUnreadCount).toHaveBeenCalled());
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  test('opens the dropdown on click', async () => {
    useAuth.mockReturnValue({ isAuthenticated: true, isBootstrapping: false });
    getUnreadCount.mockResolvedValue({ data: { unread_count: 1 } });
    listNotifications.mockResolvedValue({
      data: [],
      meta: { has_more: false },
    });
    renderBell();
    const user = userEvent.setup();

    const trigger = await screen.findByRole('button');
    await user.click(trigger);

    expect(
      await screen.findByText('Ծանուցումներ դեռ չկան'),
    ).toBeInTheDocument();
  });
});
