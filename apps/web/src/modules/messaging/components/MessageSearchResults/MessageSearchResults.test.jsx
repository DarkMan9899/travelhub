import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MessageSearchResults from './MessageSearchResults.jsx';
import {
  searchMessages,
  listConversations,
} from '../../../../api/messaging.js';

vi.mock('../../../../api/messaging.js', () => ({
  searchMessages: vi.fn(),
  listConversations: vi.fn(),
}));

function renderResults({
  query = 'refund',
  onSelectConversation = vi.fn(),
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
              <MessageSearchResults
                query={query}
                onSelectConversation={onSelectConversation}
              />
            }
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('MessageSearchResults (apps/web/src/modules/messaging)', () => {
  beforeEach(() => {
    searchMessages.mockReset();
    listConversations.mockReset();
    listConversations.mockResolvedValue({
      data: [
        {
          id: 7,
          participants: [
            { user_id: 2, first_name: 'Ada', last_name: 'Lovelace' },
          ],
        },
      ],
      meta: { has_more: false },
    });
  });

  test('shows an empty state when nothing matches', async () => {
    searchMessages.mockResolvedValue({ data: [], meta: { has_more: false } });
    renderResults();
    expect(
      await screen.findByText('Հաղորդագրություններ չեն գտնվել'),
    ).toBeInTheDocument();
  });

  test('resolves the conversation title from the loaded conversation list', async () => {
    searchMessages.mockResolvedValue({
      data: [
        {
          id: 5,
          conversation_id: 7,
          sender_user_id: 2,
          body: 'a refund was issued',
          created_at: new Date().toISOString(),
        },
      ],
      meta: { has_more: false },
    });
    renderResults();
    expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByText('a refund was issued')).toBeInTheDocument();
  });

  test('falls back to a generic label when the conversation isn’t in the loaded list', async () => {
    searchMessages.mockResolvedValue({
      data: [
        {
          id: 5,
          conversation_id: 999,
          sender_user_id: 2,
          body: 'a refund was issued',
          created_at: new Date().toISOString(),
        },
      ],
      meta: { has_more: false },
    });
    renderResults();
    expect(await screen.findByText('Խոսակցություն')).toBeInTheDocument();
  });

  test('calls onSelectConversation when a result is clicked', async () => {
    searchMessages.mockResolvedValue({
      data: [
        {
          id: 5,
          conversation_id: 7,
          sender_user_id: 2,
          body: 'a refund was issued',
          created_at: new Date().toISOString(),
        },
      ],
      meta: { has_more: false },
    });
    const onSelectConversation = vi.fn();
    renderResults({ onSelectConversation });

    const row = await screen.findByRole('button');
    row.click();
    await waitFor(() => expect(onSelectConversation).toHaveBeenCalledWith(7));
  });
});
