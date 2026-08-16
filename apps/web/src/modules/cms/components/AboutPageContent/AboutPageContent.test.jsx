import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import AboutPageContent from './AboutPageContent.jsx';

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/hy/about']}>
      <Routes>
        <Route path="/:locale/about" element={<AboutPageContent />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('AboutPageContent (apps/web/src/modules/cms)', () => {
  test('renders the page heading and three value propositions', () => {
    renderPage();
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(3);
  });
});
