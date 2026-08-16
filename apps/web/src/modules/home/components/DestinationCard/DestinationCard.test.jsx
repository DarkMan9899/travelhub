import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import DestinationCard from './DestinationCard.jsx';

const DESTINATION = { id: 'yerevan', image: '/yerevan.svg' };

function renderCard() {
  return render(
    <MemoryRouter initialEntries={['/en']}>
      <Routes>
        <Route
          path="/:locale"
          element={<DestinationCard destination={DESTINATION} />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('DestinationCard (apps/web/src/modules/home)', () => {
  test('renders the destination name as a heading, linked to its real destination page', () => {
    renderCard();
    const heading = screen.getByRole('heading', { level: 3 });
    expect(heading).toBeInTheDocument();
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/en/destinations/yerevan');
  });

  test('hides the decorative image from assistive technology', () => {
    // `alt=""` gives the image an implicit "presentation" role, not
    // "img" — queried directly rather than via getByRole, same as
    // Hero.test.jsx's equivalent check.
    renderCard();
    const backdrop = document.querySelector('img[aria-hidden="true"]');
    expect(backdrop).toHaveAttribute('alt', '');
  });
});
