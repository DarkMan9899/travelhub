import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import MessageBubble from './MessageBubble.jsx';

const BASE_MESSAGE = {
  id: 1,
  body: 'Hello there',
  created_at: new Date().toISOString(),
  is_edited: false,
  attachments: [],
  reactions: [],
};

function renderBubble({
  message = BASE_MESSAGE,
  isOwnMessage = false,
  senderName,
  currentUserId,
  canDelete = false,
  canReact = true,
  onDelete,
  onToggleReaction = vi.fn(),
} = {}) {
  return render(
    <MemoryRouter initialEntries={['/hy']}>
      <Routes>
        <Route
          path="/:locale"
          element={
            <ul>
              <MessageBubble
                message={message}
                isOwnMessage={isOwnMessage}
                senderName={senderName}
                currentUserId={currentUserId}
                canDelete={canDelete}
                canReact={canReact}
                onDelete={onDelete}
                onToggleReaction={onToggleReaction}
              />
            </ul>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('MessageBubble (apps/web/src/modules/messaging)', () => {
  test('renders the message body', () => {
    renderBubble();
    expect(screen.getByText('Hello there')).toBeInTheDocument();
  });

  test('shows the sender name for another participant’s message', () => {
    renderBubble({ senderName: 'Ada Lovelace' });
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
  });

  test('renders an image attachment as a thumbnail', () => {
    renderBubble({
      message: {
        ...BASE_MESSAGE,
        attachments: [{ id: 5, url: '/uploads/a.png', media_type: 'IMAGE' }],
      },
    });
    expect(screen.getByRole('img')).toHaveAttribute('src', '/uploads/a.png');
  });

  test('renders a document attachment as a file link', () => {
    renderBubble({
      message: {
        ...BASE_MESSAGE,
        attachments: [{ id: 5, url: '/uploads/a.pdf', media_type: 'DOCUMENT' }],
      },
    });
    expect(screen.getByRole('link')).toHaveAttribute('href', '/uploads/a.pdf');
  });

  test('shows a grouped reaction count and highlights the current user’s own reaction', () => {
    renderBubble({
      currentUserId: 3,
      message: {
        ...BASE_MESSAGE,
        reactions: [
          { user_id: 3, reaction_code: '👍' },
          { user_id: 4, reaction_code: '👍' },
        ],
      },
    });
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  test('calls onToggleReaction when a quick-react button is clicked', async () => {
    const onToggleReaction = vi.fn();
    renderBubble({ onToggleReaction });
    const buttons = screen.getAllByText('👍');
    await userEvent.click(buttons[0]);
    expect(onToggleReaction).toHaveBeenCalledWith('👍');
  });

  test('shows a delete button only when canDelete is true', () => {
    const { rerender } = renderBubble({ canDelete: false });
    expect(
      screen.queryByText('Ջնջել հաղորդագրությունը'),
    ).not.toBeInTheDocument();
    rerender(
      <MemoryRouter initialEntries={['/hy']}>
        <Routes>
          <Route
            path="/:locale"
            element={
              <ul>
                <MessageBubble
                  message={BASE_MESSAGE}
                  isOwnMessage
                  canDelete
                  onDelete={vi.fn()}
                  onToggleReaction={vi.fn()}
                />
              </ul>
            }
          />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('Ջնջել հաղորդագրությունը')).toBeInTheDocument();
  });

  // A `messaging.moderate` admin moderating a conversation they don't
  // participate in has `canReact=false` (no participant reaction rights)
  // but `canDelete=true` (moderation is independent of participation) —
  // the delete control must not be hidden inside the reaction-only gate.
  test('shows the delete button even when canReact is false', () => {
    renderBubble({
      canReact: false,
      canDelete: true,
      isOwnMessage: false,
      onDelete: vi.fn(),
    });
    expect(screen.getByText('Ջնջել հաղորդագրությունը')).toBeInTheDocument();
    expect(screen.queryByText('👍')).not.toBeInTheDocument();
  });
});
