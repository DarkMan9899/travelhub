import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SearchFilters from './SearchFilters.jsx';
import { useCategoriesQuery } from '../../queries/useCategoriesQuery.js';

vi.mock('../../queries/useCategoriesQuery.js', () => ({
  useCategoriesQuery: vi.fn(),
  default: vi.fn(),
}));

const CATEGORIES = [
  { id: 1, slug: 'hotels', name: 'Hotels', listing_count: 4 },
  { id: 2, slug: 'tours', name: 'Tours', listing_count: 2 },
];

const DEFAULT_FILTERS = {
  destination: '',
  categoryId: undefined,
  sort: 'newest',
};

function renderFilters(overrides = {}) {
  const onUpdateFilters = vi.fn();
  const onClearFilters = vi.fn();
  render(
    <SearchFilters
      filters={{ ...DEFAULT_FILTERS, ...overrides.filters }}
      onUpdateFilters={onUpdateFilters}
      onClearFilters={onClearFilters}
      hasActiveFilters={overrides.hasActiveFilters ?? false}
    />,
  );
  return { onUpdateFilters, onClearFilters };
}

describe('SearchFilters (apps/web/src/modules/search)', () => {
  beforeEach(() => {
    useCategoriesQuery.mockReturnValue({ data: CATEGORIES, isPending: false });
  });

  test('debounces keyword typing before updating filters, using replace history', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const { onUpdateFilters } = renderFilters();

    await user.type(screen.getByRole('textbox'), 'yerevan');
    expect(onUpdateFilters).not.toHaveBeenCalled();

    vi.advanceTimersByTime(500);
    expect(onUpdateFilters).toHaveBeenCalledWith(
      { destination: 'yerevan' },
      { replace: true },
    );
    vi.useRealTimers();
  });

  test('selecting a category updates filters with push history (not replace)', async () => {
    const user = userEvent.setup();
    const { onUpdateFilters } = renderFilters();

    await user.click(screen.getAllByTestId('select-trigger')[0]);
    await user.click(screen.getByText('Hotels'));

    expect(onUpdateFilters).toHaveBeenCalledWith(
      { categoryId: 1 },
      { replace: false },
    );
  });

  // The test harness's i18n instance defaults to Armenian (tests/setup.js)
  // — these assert against the real translation content, not English.
  // The option text only exists in the DOM once the Select is opened —
  // its closed trigger only shows the *currently selected* value.
  test('excludes "relevance" from sort options when there is no destination', async () => {
    const user = userEvent.setup();
    renderFilters();
    await user.click(screen.getAllByTestId('select-trigger')[1]);
    expect(screen.queryByText('Լավագույն համընկնում')).not.toBeInTheDocument();
  });

  test('includes "relevance" once a destination is present', async () => {
    const user = userEvent.setup();
    renderFilters({ filters: { destination: 'yerevan' } });
    await user.click(screen.getAllByTestId('select-trigger')[1]);
    expect(screen.getByText('Լավագույն համընկնում')).toBeInTheDocument();
  });

  test('renders a chip per active filter and removes just that one on click', async () => {
    const user = userEvent.setup();
    const { onUpdateFilters } = renderFilters({
      filters: { destination: 'yerevan', categoryId: 1 },
      hasActiveFilters: true,
    });

    // Scoped to the chips group — "Hotels" also appears as the category
    // Select's own currently-selected trigger label.
    const chips = screen.getByRole('group', { name: 'Ակտիվ զտիչներ' });
    expect(within(chips).getByText('yerevan')).toBeInTheDocument();
    expect(within(chips).getByText('Hotels')).toBeInTheDocument();

    await user.click(within(chips).getByText('yerevan').closest('button'));
    expect(onUpdateFilters).toHaveBeenCalledWith(
      { destination: '' },
      { replace: false },
    );
  });

  test('renders a "clear all" action that calls onClearFilters', async () => {
    const user = userEvent.setup();
    const { onClearFilters } = renderFilters({
      filters: { destination: 'yerevan' },
      hasActiveFilters: true,
    });
    await user.click(screen.getByRole('button', { name: 'Մաքրել զտիչները' }));
    expect(onClearFilters).toHaveBeenCalledTimes(1);
  });

  test('renders no chips/clear-all when there are no active filters', () => {
    renderFilters({ hasActiveFilters: false });
    expect(
      screen.queryByRole('button', { name: 'Մաքրել զտիչները' }),
    ).not.toBeInTheDocument();
  });
});
