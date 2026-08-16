import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { useSearchFilters } from './useSearchFilters.js';

// A minimal harness rather than `renderHook` — exercises the hook the
// same way every real consumer (SearchFilters/SearchPageContent) does,
// through actual DOM events driving actual URL changes.
function Harness() {
  const {
    filters,
    updateFilters,
    updateDynamicFilter,
    clearFilters,
    hasActiveFilters,
  } = useSearchFilters();
  return (
    <div>
      <p data-testid="destination">{filters.destination}</p>
      <p data-testid="categoryId">{String(filters.categoryId ?? '')}</p>
      <p data-testid="sort">{filters.sort}</p>
      <p data-testid="hasActiveFilters">{String(hasActiveFilters)}</p>
      <p data-testid="dynamicFilters">
        {JSON.stringify(filters.dynamicFilters)}
      </p>
      <button
        type="button"
        onClick={() => updateFilters({ destination: 'yerevan' })}
      >
        set destination
      </button>
      <button type="button" onClick={() => updateFilters({ categoryId: 5 })}>
        set category
      </button>
      <button type="button" onClick={() => updateFilters({ categoryId: 9 })}>
        set different category
      </button>
      <button
        type="button"
        onClick={() => updateFilters({ sort: 'relevance' })}
      >
        set relevance
      </button>
      <button type="button" onClick={() => updateFilters({ destination: '' })}>
        clear destination
      </button>
      <button type="button" onClick={clearFilters}>
        clear all
      </button>
      <button
        type="button"
        onClick={() => updateDynamicFilter({ attr_bedrooms_min: '2' })}
      >
        set bedrooms
      </button>
      <button
        type="button"
        onClick={() => updateDynamicFilter({ amenityIds: '1,2' })}
      >
        set amenities
      </button>
      <button
        type="button"
        onClick={() => updateDynamicFilter({ attr_bedrooms_min: '' })}
      >
        clear bedrooms
      </button>
    </div>
  );
}

function renderHarness(initialEntry = '/en/search') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/:locale/search" element={<Harness />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('useSearchFilters (apps/web/src/modules/search)', () => {
  test('defaults to no active filters', () => {
    renderHarness();
    expect(screen.getByTestId('destination')).toHaveTextContent('');
    expect(screen.getByTestId('sort')).toHaveTextContent('newest');
    expect(screen.getByTestId('hasActiveFilters')).toHaveTextContent('false');
  });

  test('parses filters already present in the URL (deep link)', () => {
    renderHarness('/en/search?destination=dilijan&categoryId=2&sort=oldest');
    expect(screen.getByTestId('destination')).toHaveTextContent('dilijan');
    expect(screen.getByTestId('categoryId')).toHaveTextContent('2');
    expect(screen.getByTestId('sort')).toHaveTextContent('oldest');
    expect(screen.getByTestId('hasActiveFilters')).toHaveTextContent('true');
  });

  test('updateFilters writes a change back to the parsed state', async () => {
    const user = userEvent.setup();
    renderHarness();
    await user.click(screen.getByRole('button', { name: 'set destination' }));
    expect(screen.getByTestId('destination')).toHaveTextContent('yerevan');
    expect(screen.getByTestId('hasActiveFilters')).toHaveTextContent('true');
  });

  test('downgrades "relevance" sort back to the default once the destination is cleared', async () => {
    const user = userEvent.setup();
    renderHarness('/en/search?destination=yerevan&sort=relevance');
    expect(screen.getByTestId('sort')).toHaveTextContent('relevance');

    await user.click(screen.getByRole('button', { name: 'clear destination' }));
    expect(screen.getByTestId('destination')).toHaveTextContent('');
    expect(screen.getByTestId('sort')).toHaveTextContent('newest');
  });

  test('clearFilters removes every filter from the URL', async () => {
    const user = userEvent.setup();
    renderHarness('/en/search?destination=yerevan&categoryId=2&sort=oldest');
    await user.click(screen.getByRole('button', { name: 'clear all' }));
    expect(screen.getByTestId('destination')).toHaveTextContent('');
    expect(screen.getByTestId('categoryId')).toHaveTextContent('');
    expect(screen.getByTestId('sort')).toHaveTextContent('newest');
    expect(screen.getByTestId('hasActiveFilters')).toHaveTextContent('false');
  });

  test('updateDynamicFilter merges a new key into the dynamicFilters bag', async () => {
    const user = userEvent.setup();
    renderHarness();
    await user.click(screen.getByRole('button', { name: 'set bedrooms' }));
    expect(screen.getByTestId('dynamicFilters')).toHaveTextContent(
      JSON.stringify({ attr_bedrooms_min: '2' }),
    );
    expect(screen.getByTestId('hasActiveFilters')).toHaveTextContent('true');
  });

  test('updateDynamicFilter merges without clobbering a previously set key', async () => {
    const user = userEvent.setup();
    renderHarness();
    await user.click(screen.getByRole('button', { name: 'set bedrooms' }));
    await user.click(screen.getByRole('button', { name: 'set amenities' }));
    expect(screen.getByTestId('dynamicFilters')).toHaveTextContent(
      JSON.stringify({ attr_bedrooms_min: '2', amenityIds: '1,2' }),
    );
  });

  test('an empty value in updateDynamicFilter removes that key', async () => {
    const user = userEvent.setup();
    renderHarness();
    await user.click(screen.getByRole('button', { name: 'set bedrooms' }));
    await user.click(screen.getByRole('button', { name: 'clear bedrooms' }));
    expect(screen.getByTestId('dynamicFilters')).toHaveTextContent('{}');
  });

  test('changing categoryId clears dynamicFilters (stale attributes no longer apply)', async () => {
    const user = userEvent.setup();
    renderHarness();
    await user.click(screen.getByRole('button', { name: 'set bedrooms' }));
    await user.click(screen.getByRole('button', { name: 'set category' }));
    await user.click(
      screen.getByRole('button', { name: 'set different category' }),
    );
    expect(screen.getByTestId('dynamicFilters')).toHaveTextContent('{}');
    expect(screen.getByTestId('categoryId')).toHaveTextContent('9');
  });

  test('re-selecting the same categoryId does not clear dynamicFilters', async () => {
    const user = userEvent.setup();
    renderHarness();
    await user.click(screen.getByRole('button', { name: 'set category' }));
    await user.click(screen.getByRole('button', { name: 'set bedrooms' }));
    await user.click(screen.getByRole('button', { name: 'set category' }));
    expect(screen.getByTestId('dynamicFilters')).toHaveTextContent(
      JSON.stringify({ attr_bedrooms_min: '2' }),
    );
  });
});
