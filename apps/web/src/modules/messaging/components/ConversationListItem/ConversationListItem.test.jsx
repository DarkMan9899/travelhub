import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ConversationListItem from './ConversationListItem.jsx';

function renderItem(conversation, { isActive, onClick = vi.fn() } = {}) {
  return render(
    <MemoryRouter initialEntries={['/hy']}>
      <Routes>
        <Route
          path="/:locale"
          element={
            <ul>
              <ConversationListItem
                conversation={conversation}
                isActive={isActive}
                onClick={onClick}
              />
            </ul>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ConversationListItem (apps/web/src/modules/messaging)', () => {
  test('renders the other participant name and last message preview', () => {
    renderItem({
      id: 1,
      participants: [{ user_id: 2, first_name: 'Ada', last_name: 'Lovelace' }],
      last_message_preview: 'See you there!',
      unread_count: 0,
    });
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByText('See you there!')).toBeInTheDocument();
  });

  test('shows an unread badge when unread_count > 0', () => {
    renderItem({
      id: 1,
      participants: [{ user_id: 2, first_name: 'Ada', last_name: 'Lovelace' }],
      last_message_preview: 'Hello',
      unread_count: 3,
    });
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  test('shows no badge when there are zero unread messages', () => {
    renderItem({
      id: 1,
      participants: [{ user_id: 2, first_name: 'Ada', last_name: 'Lovelace' }],
      last_message_preview: 'Hello',
      unread_count: 0,
    });
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  test('calls onClick when clicked', async () => {
    const onClick = vi.fn();
    renderItem(
      {
        id: 1,
        participants: [{ user_id: 2, first_name: 'Ada' }],
        unread_count: 0,
      },
      { onClick },
    );
    await userEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
