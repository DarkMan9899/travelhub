import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import Hero from './Hero.jsx';
import {
  useCategoriesQuery,
  useSuggestionsQuery,
} from '../../../search/index.js';

// Hero composes SearchWidget, which now depends on the real `search`
// module's query hooks (categories dropdown + destination autocomplete)
// — mocked here since this test only exercises Hero's own composition,
// not data-fetching (covered by SearchWidget.test.jsx/Categories.test.jsx).
vi.mock('../../../search/index.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useCategoriesQuery: vi.fn(),
    useSuggestionsQuery: vi.fn(),
  };
});

function renderHero() {
  useCategoriesQuery.mockReturnValue({ data: [], isPending: false });
  useSuggestionsQuery.mockReturnValue({ data: [], isPending: false });
  return render(
    <MemoryRouter initialEntries={['/en']}>
      <Routes>
        <Route path="/:locale" element={<Hero />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Hero (apps/web/src/modules/home)', () => {
  test('renders the headline as the page level-1 heading', () => {
    renderHero();
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });

  test('renders a link to the partner route', () => {
    renderHero();
    const partnerLink = screen
      .getAllByRole('link')
      .find((link) => link.getAttribute('href') === '/en/partner');
    expect(partnerLink).toBeInTheDocument();
  });

  test('renders the search widget', () => {
    renderHero();
    expect(screen.getByRole('button', { name: /Որոնել/ })).toBeInTheDocument();
  });

  test('hides the decorative backdrop image from assistive technology', () => {
    renderHero();
    const backdrop = document.querySelector('img[aria-hidden="true"]');
    expect(backdrop).toHaveAttribute('alt', '');
  });
});
