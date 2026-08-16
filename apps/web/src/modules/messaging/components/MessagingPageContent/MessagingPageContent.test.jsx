import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import MessagingPageContent from './MessagingPageContent.jsx';

vi.mock('../ConversationList/ConversationList.jsx', () => ({
  default: ({ onSelectConversation }) => (
    <button type="button" onClick={() => onSelectConversation(7)}>
      mock-conversation-list
    </button>
  ),
}));
vi.mock('../ChatWindow/ChatWindow.jsx', () => ({
  default: ({ conversationId }) => <div>mock-chat-window-{conversationId}</div>,
}));

function renderPage(initialPath) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route
          path="/:locale/account/messages"
          element={<MessagingPageContent />}
        />
        <Route
          path="/:locale/account/messages/:conversationId"
          element={<MessagingPageContent />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('MessagingPageContent (apps/web/src/modules/messaging)', () => {
  test('shows a select-a-conversation prompt when no conversation is active', () => {
    renderPage('/hy/account/messages');
    expect(
      screen.getByText('Ընտրեք խոսակցություն՝ կարդալը սկսելու համար'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/mock-chat-window/)).not.toBeInTheDocument();
  });

  test('renders ChatWindow with the conversationId from the URL', () => {
    renderPage('/hy/account/messages/42');
    expect(screen.getByText('mock-chat-window-42')).toBeInTheDocument();
  });

  test('navigates to the conversation URL when a conversation is selected', async () => {
    renderPage('/hy/account/messages');
    screen.getByText('mock-conversation-list').click();
    expect(await screen.findByText('mock-chat-window-7')).toBeInTheDocument();
  });
});
