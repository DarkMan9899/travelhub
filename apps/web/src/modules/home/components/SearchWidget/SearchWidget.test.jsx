import { describe, test, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import SearchWidget from './SearchWidget.jsx';
import {
  useCategoriesQuery,
  useSuggestionsQuery,
} from '../../../search/index.js';

// `vi.hoisted` so `navigateMock` exists before `vi.mock`'s factory runs
// (vitest hoists `vi.mock` calls above regular imports/consts) —
// `vi.spyOn(reactRouterDom, 'useNavigate')` fails here with "Cannot
// redefine property" since the real module's export isn't configurable
// under this build.
const { navigateMock } = vi.hoisted(() => ({ navigateMock: vi.fn() }));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useNavigate: () => navigateMock };
});

vi.mock('../../../search/index.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useCategoriesQuery: vi.fn(),
    useSuggestionsQuery: vi.fn(),
  };
});

function renderSearchWidget() {
  return render(
    <MemoryRouter initialEntries={['/en']}>
      <Routes>
        <Route path="/:locale" element={<SearchWidget />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('SearchWidget (apps/web/src/modules/home)', () => {
  beforeEach(() => {
    navigateMock.mockClear();
    useCategoriesQuery.mockReturnValue({ data: [], isPending: false });
    useSuggestionsQuery.mockReturnValue({ data: [], isPending: false });
  });

  test('renders the destination field and submit control', () => {
    renderSearchWidget();
    expect(
      screen.getByRole('combobox', { name: /Ուղղություն/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Որոնել/ })).toBeInTheDocument();
  });

  test('submits, navigating to the search route with the destination preserved as a URL param', async () => {
    const user = userEvent.setup();

    renderSearchWidget();
    await user.type(
      screen.getByRole('combobox', { name: /Ուղղություն/ }),
      'Yerevan',
    );
    await user.click(screen.getByRole('button', { name: /Որոնել/ }));

    expect(navigateMock).toHaveBeenCalledWith('/en/search?destination=Yerevan');
  });

  test('submits with no query string when every field is left empty', async () => {
    const user = userEvent.setup();

    renderSearchWidget();
    await user.click(screen.getByRole('button', { name: /Որոնել/ }));

    expect(navigateMock).toHaveBeenCalledWith('/en/search');
  });

  test('renders real categories from the API as select options', () => {
    useCategoriesQuery.mockReturnValue({
      data: [{ id: 1, slug: 'hotels', name: 'Hotels', listing_count: 4 }],
      isPending: false,
    });
    renderSearchWidget();
    expect(screen.getAllByTestId('select-trigger').length).toBeGreaterThan(0);
  });
});
