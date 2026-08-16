import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import PopularExperiences from './PopularExperiences.jsx';
import POPULAR_EXPERIENCES from '../../constants/experiences.js';

function renderSection() {
  return render(
    <MemoryRouter initialEntries={['/en']}>
      <Routes>
        <Route path="/:locale" element={<PopularExperiences />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('PopularExperiences (apps/web/src/modules/home)', () => {
  test('renders a labeled section landmark', () => {
    renderSection();
    expect(screen.getByRole('region')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument();
  });

  test('renders one card per curated experience inside the showcase', () => {
    renderSection();
    const experienceLinks = screen
      .getAllByRole('link')
      .filter((link) => link.getAttribute('href')?.includes('/search?type='));
    expect(experienceLinks).toHaveLength(POPULAR_EXPERIENCES.length);
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
