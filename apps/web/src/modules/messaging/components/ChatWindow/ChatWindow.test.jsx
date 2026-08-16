import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ChatWindow from './ChatWindow.jsx';
import { useAuth } from '../../../../contexts/AuthContext.jsx';
import {
  getConversation,
  listMessages,
  listTypingUsers,
  markConversationRead,
} from '../../../../api/messaging.js';

vi.mock('../../../../contexts/AuthContext.jsx', () => ({ useAuth: vi.fn() }));
vi.mock('../../../../api/messaging.js', () => ({
  getConversation: vi.fn(),
  listMessages: vi.fn(),
  listTypingUsers: vi.fn(),
  markConversationRead: vi.fn(),
  deleteMessage: vi.fn(),
  toggleMessageReaction: vi.fn(),
  sendMessage: vi.fn(),
  uploadMessageAttachment: vi.fn(),
  setTyping: vi.fn(),
  archiveConversation: vi.fn(),
  unarchiveConversation: vi.fn(),
}));

function renderChatWindow() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/hy']}>
        <Routes>
          <Route path="/:locale" element={<ChatWindow conversationId={1} />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ChatWindow (apps/web/src/modules/messaging)', () => {
  beforeEach(() => {
    useAuth.mockReturnValue({ user: { id: 1 }, permissions: [] });
    getConversation.mockReset();
    listMessages.mockReset();
    listTypingUsers.mockReset();
    markConversationRead.mockReset();

    listTypingUsers.mockResolvedValue({ data: { typing_user_ids: [] } });
    markConversationRead.mockResolvedValue({ data: {} });
  });

  test('renders the other participant’s name as the header title', async () => {
    getConversation.mockResolvedValue({
      data: {
        id: 1,
        participants: [
          { user_id: 2, first_name: 'Ada', last_name: 'Lovelace' },
        ],
        unread_count: 0,
        is_archived_for_participant: false,
      },
    });
    listMessages.mockResolvedValue({ data: [], meta: { has_more: false } });
    renderChatWindow();
    expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument();
  });

  test('renders each message’s body text', async () => {
    getConversation.mockResolvedValue({
      data: {
        id: 1,
        participants: [{ user_id: 2, first_name: 'Ada' }],
        unread_count: 0,
        is_archived_for_participant: false,
      },
    });
    listMessages.mockResolvedValue({
      data: [
        {
          id: 10,
          sender_user_id: 2,
          body: 'Hi there',
          attachments: [],
          reactions: [],
          created_at: new Date().toISOString(),
        },
      ],
      meta: { has_more: false },
    });
    renderChatWindow();
    expect(await screen.findByText('Hi there')).toBeInTheDocument();
  });

  test('marks the conversation read when unread messages exist', async () => {
    getConversation.mockResolvedValue({
      data: {
        id: 1,
        participants: [{ user_id: 2, first_name: 'Ada' }],
        unread_count: 1,
        last_read_message_id: 9,
        is_archived_for_participant: false,
      },
    });
    listMessages.mockResolvedValue({
      data: [
        {
          id: 10,
          sender_user_id: 2,
          body: 'Hi there',
          attachments: [],
          reactions: [],
          created_at: new Date().toISOString(),
        },
      ],
      meta: { has_more: false },
    });
    renderChatWindow();
    await waitFor(() =>
      expect(markConversationRead).toHaveBeenCalledWith(1, 10),
    );
  });

  test('shows an empty state for a conversation with no messages', async () => {
    getConversation.mockResolvedValue({
      data: {
        id: 1,
        participants: [{ user_id: 2, first_name: 'Ada' }],
        unread_count: 0,
        is_archived_for_participant: false,
      },
    });
    listMessages.mockResolvedValue({ data: [], meta: { has_more: false } });
    renderChatWindow();
    expect(
      await screen.findByText('Հաղորդագրություններ դեռ չկան'),
    ).toBeInTheDocument();
  });

  test('shows an error state when the conversation fails to load', async () => {
    getConversation.mockRejectedValue(new Error('network error'));
    listMessages.mockResolvedValue({ data: [], meta: { has_more: false } });
    renderChatWindow();
    expect(
      await screen.findByRole('button', { name: 'Կրկին փորձել' }),
    ).toBeInTheDocument();
  });

  test('shows the composer and archive control for a real participant', async () => {
    getConversation.mockResolvedValue({
      data: {
        id: 1,
        participants: [{ user_id: 2, first_name: 'Ada' }],
        unread_count: 0,
        is_archived_for_participant: false,
      },
    });
    listMessages.mockResolvedValue({ data: [], meta: { has_more: false } });
    renderChatWindow();
    expect(
      await screen.findByPlaceholderText('Գրեք հաղորդագրություն…'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Արխիվացնել' }),
    ).toBeInTheDocument();
  });

  // A `messaging.view_all` reader looking at a conversation they don't
  // participate in gets the bare shape back (no `is_archived_for_participant`
  // key at all — see `conversationDto.js`) — every write control (composer,
  // archive, quick-react) must be hidden rather than shown-but-403.
  test('hides the composer and archive control for a non-participant (view_all) reader', async () => {
    getConversation.mockResolvedValue({
      data: {
        id: 1,
        participants: [
          { user_id: 2, first_name: 'Ada' },
          { user_id: 3, first_name: 'Bob' },
        ],
      },
    });
    listMessages.mockResolvedValue({
      data: [
        {
          id: 10,
          sender_user_id: 2,
          body: 'Hi there',
          attachments: [],
          reactions: [],
          created_at: new Date().toISOString(),
        },
      ],
      meta: { has_more: false },
    });
    renderChatWindow();
    await screen.findByText('Hi there');
    expect(
      screen.queryByPlaceholderText('Գրեք հաղորդագրություն…'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Արխիվացնել' }),
    ).not.toBeInTheDocument();
  });

  // A `messaging.moderate` holder can delete any message even in a
  // conversation they don't participate in — moderation is independent
  // of participation, unlike reacting/archiving/composing.
  test('shows the delete control for a messaging.moderate non-participant', async () => {
    useAuth.mockReturnValue({
      user: { id: 1 },
      permissions: ['messaging.moderate'],
    });
    getConversation.mockResolvedValue({
      data: {
        id: 1,
        participants: [
          { user_id: 2, first_name: 'Ada' },
          { user_id: 3, first_name: 'Bob' },
        ],
      },
    });
    listMessages.mockResolvedValue({
      data: [
        {
          id: 10,
          sender_user_id: 2,
          body: 'Hi there',
          attachments: [],
          reactions: [],
          created_at: new Date().toISOString(),
        },
      ],
      meta: { has_more: false },
    });
    renderChatWindow();
    expect(
      await screen.findByRole('button', { name: 'Ջնջել հաղորդագրությունը' }),
    ).toBeInTheDocument();
  });
});
