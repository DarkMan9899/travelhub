import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import FeaturedDestinations from './FeaturedDestinations.jsx';
import FEATURED_DESTINATIONS from '../../constants/destinations.js';

function renderSection() {
  return render(
    <MemoryRouter initialEntries={['/en']}>
      <Routes>
        <Route path="/:locale" element={<FeaturedDestinations />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('FeaturedDestinations (apps/web/src/modules/home)', () => {
  test('renders a labeled section landmark', () => {
    renderSection();
    expect(screen.getByRole('region')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument();
  });

  test('renders one card per curated destination inside the showcase', () => {
    renderSection();
    // Phase 20 (SEO): 5 of the 6 curated destinations now link straight to
    // a real `/destinations/:slug` landing page; `tatev` (a landmark, not
    // a seeded city) still falls back to the honest `?destination=` search
    // link — a destination card link matches one pattern or the other.
    const destinationLinks = screen.getAllByRole('link').filter((link) => {
      const href = link.getAttribute('href') ?? '';
      return href.includes('destination=') || href.includes('/destinations/');
    });
    expect(destinationLinks).toHaveLength(FEATURED_DESTINATIONS.length);
  });

  test('renders a "view all" link to the search route', () => {
    renderSection();
    // The test harness's i18n instance defaults to Armenian (tests/setup.js).
    expect(screen.getByRole('link', { name: 'Տեսնել բոլորը' })).toHaveAttribute(
      'href',
      '/en/search',
    );
  });
});
