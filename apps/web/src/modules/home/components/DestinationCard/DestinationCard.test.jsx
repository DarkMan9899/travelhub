import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import DestinationCard from './DestinationCard.jsx';

const DESTINATION = {
  id: 3,
  slug: 'yerevan',
  name: 'Yerevan',
  listing_count: 42,
};

function renderCard(destination = DESTINATION) {
  return render(
    <MemoryRouter initialEntries={['/en']}>
      <Routes>
        <Route
          path="/:locale"
          element={<DestinationCard destination={destination} />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('DestinationCard (apps/web/src/modules/home)', () => {
  test('renders the real destination name as a heading, linked to its real destination page', () => {
    renderCard();
    const heading = screen.getByRole('heading', { level: 3, name: 'Yerevan' });
    expect(heading).toBeInTheDocument();
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/en/destinations/yerevan');
  });

  test('shows the listing count when it is greater than zero', () => {
    renderCard();
    expect(screen.getByText(/42/)).toBeInTheDocument();
  });

  test('hides the listing count when it is zero', () => {
    renderCard({ ...DESTINATION, listing_count: 0 });
    expect(screen.queryByText(/հայտարարություն/)).not.toBeInTheDocument();
  });

  test('hides the decorative backdrop art from assistive technology', () => {
    // Redesign phase (2026): the backdrop is `DestinationArt` (a
    // procedural div+svg, keyed by the real destination id — no
    // per-destination photography exists yet), not an `<img>` — it
    // still carries `aria-hidden="true"` itself, same intent as the
    // `alt=""` image it replaced.
    renderCard();
    const backdrop = document.querySelector('div[aria-hidden="true"]');
    expect(backdrop).toBeInTheDocument();
  });
});
