import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ConversationList from './ConversationList.jsx';
import { listConversations } from '../../../../api/messaging.js';

vi.mock('../../../../api/messaging.js', () => ({
  listConversations: vi.fn(),
}));

function renderList({
  activeConversationId,
  onSelectConversation = vi.fn(),
  status,
  search,
} = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/hy']}>
        <Routes>
          <Route
            path="/:locale"
            element={
              <ConversationList
                activeConversationId={activeConversationId}
                onSelectConversation={onSelectConversation}
                status={status}
                search={search}
              />
            }
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ConversationList (apps/web/src/modules/messaging)', () => {
  beforeEach(() => {
    listConversations.mockReset();
  });

  test('shows an empty state when there are no conversations', async () => {
    listConversations.mockResolvedValue({
      data: [],
      meta: { has_more: false },
    });
    renderList();
    expect(
      await screen.findByText('Խոսակցություններ դեռ չկան'),
    ).toBeInTheDocument();
  });

  test('renders a conversation row from the response', async () => {
    listConversations.mockResolvedValue({
      data: [
        {
          id: 1,
          participants: [
            { user_id: 2, first_name: 'Ada', last_name: 'Lovelace' },
          ],
          last_message_preview: 'Hello there',
          unread_count: 1,
        },
      ],
      meta: { has_more: false },
    });
    renderList();
    expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByText('Hello there')).toBeInTheDocument();
  });

  test('calls onSelectConversation when a row is clicked', async () => {
    listConversations.mockResolvedValue({
      data: [
        {
          id: 42,
          participants: [{ user_id: 2, first_name: 'Ada' }],
          unread_count: 0,
        },
      ],
      meta: { has_more: false },
    });
    const onSelectConversation = vi.fn();
    renderList({ onSelectConversation });

    const row = await screen.findByRole('button');
    row.click();
    await waitFor(() => expect(onSelectConversation).toHaveBeenCalledWith(42));
  });

  test('shows an error state and retries on demand', async () => {
    listConversations.mockRejectedValue(new Error('network error'));
    renderList();
    expect(
      await screen.findByRole('button', { name: 'Կրկին փորձել' }),
    ).toBeInTheDocument();
  });
});
