import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MessagingBell from './MessagingBell.jsx';
import { useAuth } from '../../../../contexts/AuthContext.jsx';
import {
  getUnreadConversationCount,
  listConversations,
} from '../../../../api/messaging.js';

vi.mock('../../../../contexts/AuthContext.jsx', () => ({ useAuth: vi.fn() }));
vi.mock('../../../../api/messaging.js', () => ({
  getUnreadConversationCount: vi.fn(),
  listConversations: vi.fn(),
}));

function renderBell() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/hy']}>
        <Routes>
          <Route path="/:locale" element={<MessagingBell />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('MessagingBell (apps/web/src/modules/messaging)', () => {
  beforeEach(() => {
    getUnreadConversationCount.mockReset();
    listConversations.mockReset();
  });

  test('renders nothing for a logged-out visitor', () => {
    useAuth.mockReturnValue({ isAuthenticated: false, isBootstrapping: false });
    renderBell();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  test('shows an unread count badge when there are unread conversations', async () => {
    useAuth.mockReturnValue({ isAuthenticated: true, isBootstrapping: false });
    getUnreadConversationCount.mockResolvedValue({
      data: { unread_count: 2 },
    });
    renderBell();
    expect(await screen.findByText('2')).toBeInTheDocument();
  });

  test('caps the displayed badge at "9+"', async () => {
    useAuth.mockReturnValue({ isAuthenticated: true, isBootstrapping: false });
    getUnreadConversationCount.mockResolvedValue({
      data: { unread_count: 15 },
    });
    renderBell();
    expect(await screen.findByText('9+')).toBeInTheDocument();
  });

  test('shows no badge when there are zero unread conversations', async () => {
    useAuth.mockReturnValue({ isAuthenticated: true, isBootstrapping: false });
    getUnreadConversationCount.mockResolvedValue({
      data: { unread_count: 0 },
    });
    renderBell();
    await waitFor(() => expect(getUnreadConversationCount).toHaveBeenCalled());
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  test('opens the dropdown on click', async () => {
    useAuth.mockReturnValue({ isAuthenticated: true, isBootstrapping: false });
    getUnreadConversationCount.mockResolvedValue({
      data: { unread_count: 1 },
    });
    listConversations.mockResolvedValue({
      data: [],
      meta: { has_more: false },
    });
    renderBell();
    const user = userEvent.setup();

    const trigger = await screen.findByRole('button');
    await user.click(trigger);

    expect(
      await screen.findByText('Խոսակցություններ դեռ չկան'),
    ).toBeInTheDocument();
  });
});
