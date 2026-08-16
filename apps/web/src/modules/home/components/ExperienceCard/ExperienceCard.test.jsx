import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ExperienceCard from './ExperienceCard.jsx';

const EXPERIENCE = {
  id: 'dilijan-hiking',
  image: '/dilijan.svg',
  categoryType: 'TOUR',
  durationHours: 4,
  rating: 4.8,
  reviewCount: 132,
  price: { amount: 35, currencyCode: 'USD' },
};

function renderCard() {
  return render(
    <MemoryRouter initialEntries={['/en']}>
      <Routes>
        <Route
          path="/:locale"
          element={<ExperienceCard experience={EXPERIENCE} />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ExperienceCard (apps/web/src/modules/home)', () => {
  test('renders the experience name as a heading, linked to the search route by category', () => {
    renderCard();
    expect(screen.getByRole('heading', { level: 3 })).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      '/en/search?type=TOUR',
    );
  });

  test('renders a rating with an accessible label', () => {
    renderCard();
    expect(screen.getByRole('img', { name: /4\.8/ })).toBeInTheDocument();
  });

  test('renders a formatted price', () => {
    renderCard();
    expect(screen.getByText(/35/)).toBeInTheDocument();
  });
});
