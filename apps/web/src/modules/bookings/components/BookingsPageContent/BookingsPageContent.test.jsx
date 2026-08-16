import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import BookingsPageContent from './BookingsPageContent.jsx';
import { useMyBookingsQuery } from '../../queries/useMyBookingsQuery.js';

vi.mock('../../queries/useMyBookingsQuery.js', () => ({
  useMyBookingsQuery: vi.fn(),
  default: vi.fn(),
}));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/en/account/bookings']}>
      <Routes>
        <Route
          path="/:locale/account/bookings"
          element={<BookingsPageContent />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('BookingsPageContent (apps/web/src/modules/bookings)', () => {
  beforeEach(() => {
    useMyBookingsQuery.mockReset();
  });

  test('renders the heading and an empty state when the caller has no bookings', () => {
    useMyBookingsQuery.mockReturnValue({
      data: { pages: [{ results: [], meta: {} }] },
      isPending: false,
      isError: false,
      refetch: vi.fn(),
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
    });
    renderPage();
    expect(
      screen.getByRole('heading', { name: 'Իմ ամրագրումները' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Դեռ ամրագրումներ չկան' }),
    ).toBeInTheDocument();
  });

  test('renders a retryable error state when the query fails', () => {
    useMyBookingsQuery.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
      refetch: vi.fn(),
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
    });
    renderPage();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});
