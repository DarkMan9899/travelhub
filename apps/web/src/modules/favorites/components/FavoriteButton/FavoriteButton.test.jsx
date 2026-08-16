import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import FavoriteButton from './FavoriteButton.jsx';
import { useAuth } from '../../../../contexts/AuthContext.jsx';
import {
  listFavoriteIds,
  addFavorite,
  removeFavorite,
} from '../../../../api/favorites.js';

vi.mock('../../../../contexts/AuthContext.jsx', () => ({ useAuth: vi.fn() }));
vi.mock('../../../../api/favorites.js', () => ({
  listFavoriteIds: vi.fn(),
  addFavorite: vi.fn(),
  removeFavorite: vi.fn(),
}));

function renderButton(listingId = 5) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <FavoriteButton listingId={listingId} />
    </QueryClientProvider>,
  );
}

describe('FavoriteButton (apps/web/src/modules/favorites)', () => {
  beforeEach(() => {
    listFavoriteIds.mockReset();
    addFavorite.mockReset();
    removeFavorite.mockReset();
  });

  test('renders nothing for a logged-out visitor', () => {
    useAuth.mockReturnValue({ isAuthenticated: false });
    renderButton();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  test('calls addFavorite when the listing is not yet favorited', async () => {
    useAuth.mockReturnValue({ isAuthenticated: true });
    listFavoriteIds.mockResolvedValue({ data: [] });
    addFavorite.mockResolvedValue({});
    renderButton(5);
    const user = userEvent.setup();

    await waitFor(() => expect(screen.getByRole('button')).toBeInTheDocument());
    await user.click(screen.getByRole('button'));

    await waitFor(() => expect(addFavorite).toHaveBeenCalledWith(5));
    expect(removeFavorite).not.toHaveBeenCalled();
  });

  test('calls removeFavorite when the listing is already favorited', async () => {
    useAuth.mockReturnValue({ isAuthenticated: true });
    listFavoriteIds.mockResolvedValue({ data: [5] });
    removeFavorite.mockResolvedValue({});
    renderButton(5);
    const user = userEvent.setup();

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Հեռացնել ընտրյալներից' }),
      ).toBeInTheDocument(),
    );
    await user.click(screen.getByRole('button'));

    await waitFor(() => expect(removeFavorite).toHaveBeenCalledWith(5));
    expect(addFavorite).not.toHaveBeenCalled();
  });
});
