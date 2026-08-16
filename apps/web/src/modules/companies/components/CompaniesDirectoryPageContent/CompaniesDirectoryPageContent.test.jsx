import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import CompaniesDirectoryPageContent from './CompaniesDirectoryPageContent.jsx';
import { useCompaniesQuery } from '../../queries/useCompaniesQuery.js';

vi.mock('../../queries/useCompaniesQuery.js', () => ({
  useCompaniesQuery: vi.fn(),
  default: vi.fn(),
}));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/hy/companies']}>
      <Routes>
        <Route
          path="/:locale/companies"
          element={<CompaniesDirectoryPageContent />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

const BASE_COMPANY = {
  id: 1,
  slug: 'yerevan-boutique-hospitality',
  display_name: 'Yerevan Boutique Hospitality',
  description: 'A boutique hospitality partner.',
  logo_url: null,
  cover_url: null,
  listing_count: 3,
  is_verified: true,
};

describe('CompaniesDirectoryPageContent (apps/web/src/modules/companies)', () => {
  test('renders the page heading', () => {
    useCompaniesQuery.mockReturnValue({
      data: undefined,
      isPending: true,
      isError: false,
      refetch: vi.fn(),
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
    });
    renderPage();
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });

  test('flattens paginated results into one grid', () => {
    useCompaniesQuery.mockReturnValue({
      data: {
        pages: [
          { results: [{ ...BASE_COMPANY, id: 1, display_name: 'First Co' }] },
          { results: [{ ...BASE_COMPANY, id: 2, display_name: 'Second Co' }] },
        ],
      },
      isPending: false,
      isError: false,
      refetch: vi.fn(),
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
    });
    renderPage();
    expect(screen.getByText('First Co')).toBeInTheDocument();
    expect(screen.getByText('Second Co')).toBeInTheDocument();
  });

  test('shows an empty state when there are no companies', () => {
    useCompaniesQuery.mockReturnValue({
      data: { pages: [{ results: [] }] },
      isPending: false,
      isError: false,
      refetch: vi.fn(),
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
    });
    renderPage();
    expect(screen.queryByText('First Co')).not.toBeInTheDocument();
  });

  test('shows a retryable error state on failure', async () => {
    const refetch = vi.fn();
    const user = userEvent.setup();
    useCompaniesQuery.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
      refetch,
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
    });
    renderPage();
    await user.click(screen.getByRole('button'));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  test('wires the load-more action to fetchNextPage', async () => {
    const fetchNextPage = vi.fn();
    const user = userEvent.setup();
    useCompaniesQuery.mockReturnValue({
      data: { pages: [{ results: [BASE_COMPANY] }] },
      isPending: false,
      isError: false,
      refetch: vi.fn(),
      fetchNextPage,
      hasNextPage: true,
      isFetchingNextPage: false,
    });
    renderPage();
    await user.click(screen.getByRole('button', { name: /Բեռնել/ }));
    expect(fetchNextPage).toHaveBeenCalledTimes(1);
  });
});
