import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import NotificationRow from './NotificationRow.jsx';

function renderRow(notification, overrides = {}) {
  return render(
    <MemoryRouter initialEntries={['/hy']}>
      <Routes>
        <Route
          path="/:locale"
          element={
            <ul>
              <NotificationRow
                notification={notification}
                onMarkRead={overrides.onMarkRead ?? vi.fn()}
                onArchive={overrides.onArchive ?? vi.fn()}
                onDelete={overrides.onDelete ?? vi.fn()}
              />
            </ul>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

const BASE_NOTIFICATION = {
  id: 1,
  event_type: 'booking.confirmed',
  category: 'BOOKING',
  payload: { bookingReference: 'BK-42' },
  is_read: false,
  is_archived: false,
  created_at: new Date().toISOString(),
};

describe('NotificationRow (apps/web/src/modules/notifications)', () => {
  test('renders the mapped copy for a known event type', () => {
    renderRow(BASE_NOTIFICATION);
    expect(screen.getByText(/BK-42/)).toBeInTheDocument();
  });

  test('renders an unread indicator only when unread', () => {
    const { rerender } = renderRow(BASE_NOTIFICATION);
    expect(screen.getByLabelText('Չկարդացած')).toBeInTheDocument();

    rerender(
      <MemoryRouter initialEntries={['/hy']}>
        <Routes>
          <Route
            path="/:locale"
            element={
              <ul>
                <NotificationRow
                  notification={{ ...BASE_NOTIFICATION, is_read: true }}
                  onMarkRead={vi.fn()}
                  onArchive={vi.fn()}
                  onDelete={vi.fn()}
                />
              </ul>
            }
          />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.queryByLabelText('Չկարդացած')).not.toBeInTheDocument();
  });

  test('renders admin.announcement payload as raw text, not a translation lookup', () => {
    renderRow({
      ...BASE_NOTIFICATION,
      event_type: 'admin.announcement',
      category: 'ADMIN',
      payload: { title: 'Scheduled maintenance', body: 'Tonight at 2am.' },
    });
    expect(screen.getByText('Scheduled maintenance')).toBeInTheDocument();
    expect(screen.getByText(/Tonight at 2am\./)).toBeInTheDocument();
  });

  test('calls onMarkRead when the mark-as-read action is clicked', () => {
    const onMarkRead = vi.fn();
    renderRow(BASE_NOTIFICATION, { onMarkRead });
    screen.getByText('Նշել որպես կարդացած').click();
    expect(onMarkRead).toHaveBeenCalledWith(1);
  });

  test('calls onDelete when the delete action is clicked', () => {
    const onDelete = vi.fn();
    renderRow(BASE_NOTIFICATION, { onDelete });
    screen.getByText('Ջնջել').click();
    expect(onDelete).toHaveBeenCalledWith(1);
  });

  test('does not show an archive action for an already-archived notification', () => {
    renderRow({ ...BASE_NOTIFICATION, is_archived: true });
    expect(screen.queryByText('Արխիվացնել')).not.toBeInTheDocument();
  });
});
