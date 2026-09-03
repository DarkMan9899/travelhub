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

function renderPage(initialPath, props = {}) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route
          path="/:locale/account/messages"
          // eslint-disable-next-line react/jsx-props-no-spreading -- test-only prop passthrough
          element={<MessagingPageContent {...props} />}
        />
        <Route
          path="/:locale/account/messages/:conversationId"
          // eslint-disable-next-line react/jsx-props-no-spreading -- test-only prop passthrough
          element={<MessagingPageContent {...props} />}
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

  test('variant="operational" (Partner Workspace) applies its own container class, not the customer premium one', () => {
    renderPage('/hy/account/messages', { variant: 'operational' });
    const layout = screen
      .getByText('mock-conversation-list')
      .closest('[class*="layout"]');
    expect(layout.className).toMatch(/layout--operational/);
    expect(layout.className).not.toMatch(/layout--premium/);
  });
});
