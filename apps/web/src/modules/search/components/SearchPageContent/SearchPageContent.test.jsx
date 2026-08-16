import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import SearchPageContent from './SearchPageContent.jsx';
import { useSearchFilters } from '../../hooks/useSearchFilters.js';
import { useSearchListingsQuery } from '../../queries/useSearchListingsQuery.js';
import { useCategoriesQuery } from '../../queries/useCategoriesQuery.js';
import { useSearchFilterDefinitionsQuery } from '../../queries/useSearchFilterDefinitionsQuery.js';
import { useParseSearchQueryMutation } from '../../../ai/mutations/useParseSearchQueryMutation.js';

// Only the data-fetching/state hooks are mocked (FRONTEND_ARCHITECTURE.md
// §14 is a React Query/URL-state concern) — SearchFilters/SearchResults/
// DynamicFilterPanel render for real, exercising the real composition.
vi.mock(
  '../../../favorites/components/FavoriteButton/FavoriteButton.jsx',
  () => ({
    default: () => null,
  }),
);
vi.mock('../../hooks/useSearchFilters.js', () => ({
  useSearchFilters: vi.fn(),
  default: vi.fn(),
}));
vi.mock('../../queries/useSearchListingsQuery.js', () => ({
  useSearchListingsQuery: vi.fn(),
  default: vi.fn(),
}));
vi.mock('../../queries/useCategoriesQuery.js', () => ({
  useCategoriesQuery: vi.fn(),
  default: vi.fn(),
}));
vi.mock('../../queries/useSearchFilterDefinitionsQuery.js', () => ({
  useSearchFilterDefinitionsQuery: vi.fn(),
  default: vi.fn(),
}));
vi.mock('../../../ai/mutations/useParseSearchQueryMutation.js', () => ({
  useParseSearchQueryMutation: vi.fn(),
  default: vi.fn(),
}));

const DEFAULT_FILTERS_STATE = {
  filters: {
    destination: '',
    categoryId: undefined,
    sort: 'newest',
    dynamicFilters: {},
  },
  updateFilters: vi.fn(),
  updateDynamicFilter: vi.fn(),
  clearFilters: vi.fn(),
  hasActiveFilters: false,
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/en/search']}>
      <Routes>
        <Route path="/:locale/search" element={<SearchPageContent />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('SearchPageContent (apps/web/src/modules/search)', () => {
  beforeEach(() => {
    useCategoriesQuery.mockReturnValue({ data: [], isPending: false });
    useSearchFilters.mockReturnValue(DEFAULT_FILTERS_STATE);
    useSearchFilterDefinitionsQuery.mockReturnValue({ data: [] });
    useParseSearchQueryMutation.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
    });
  });

  test('renders the page heading', () => {
    useSearchListingsQuery.mockReturnValue({
      data: undefined,
      isPending: true,
      isError: false,
      refetch: vi.fn(),
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
    });
    renderPage();
    // The test harness's i18n instance defaults to Armenian
    // (tests/setup.js) — real "pages.search.title" content.
    expect(
      screen.getByRole('heading', { name: 'Փնտրել', level: 1 }),
    ).toBeInTheDocument();
  });

  test('flattens paginated results into one grid', () => {
    useSearchListingsQuery.mockReturnValue({
      data: {
        pages: [
          { results: [{ id: 1, listing_type: 'HOTEL', title: 'First' }] },
          { results: [{ id: 2, listing_type: 'TOUR', title: 'Second' }] },
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
    expect(screen.getByRole('heading', { name: 'First' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Second' })).toBeInTheDocument();
  });

  test('wires the load-more action to fetchNextPage', async () => {
    const fetchNextPage = vi.fn();
    const user = userEvent.setup();
    useSearchListingsQuery.mockReturnValue({
      data: {
        pages: [
          { results: [{ id: 1, listing_type: 'HOTEL', title: 'First' }] },
        ],
      },
      isPending: false,
      isError: false,
      refetch: vi.fn(),
      fetchNextPage,
      hasNextPage: true,
      isFetchingNextPage: false,
    });
    renderPage();
    // The test harness's i18n instance defaults to Armenian
    // (tests/setup.js) — real "search.results.loadMore" content. A plain
    // `getByRole('button')` would also match the category/sort Select
    // triggers (both `role="button"`), so this targets by name.
    await user.click(screen.getByRole('button', { name: 'Բեռնել ավելին' }));
    expect(fetchNextPage).toHaveBeenCalledTimes(1);
  });

  test('a category selection in the real SearchFilters calls updateFilters', async () => {
    const updateFilters = vi.fn();
    const user = userEvent.setup();
    useSearchFilters.mockReturnValue({
      ...DEFAULT_FILTERS_STATE,
      updateFilters,
    });
    useCategoriesQuery.mockReturnValue({
      data: [{ id: 1, slug: 'hotels', name: 'Hotels', listing_count: 3 }],
      isPending: false,
    });
    useSearchListingsQuery.mockReturnValue({
      data: { pages: [{ results: [] }] },
      isPending: false,
      isError: false,
      refetch: vi.fn(),
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
    });
    renderPage();

    await user.click(screen.getAllByTestId('select-trigger')[0]);
    await user.click(screen.getByText('Hotels'));

    expect(updateFilters).toHaveBeenCalledWith(
      { categoryId: 1 },
      { replace: false },
    );
  });
});
