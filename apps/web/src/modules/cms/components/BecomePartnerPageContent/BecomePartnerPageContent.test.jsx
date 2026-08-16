import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import BecomePartnerPageContent from './BecomePartnerPageContent.jsx';

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/hy/become-a-partner']}>
      <Routes>
        <Route
          path="/:locale/become-a-partner"
          element={<BecomePartnerPageContent />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('BecomePartnerPageContent (apps/web/src/modules/cms)', () => {
  test('renders the page heading, three benefits, and a single CTA button', () => {
    renderPage();
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(3);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });
});
