import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import HelpCenterPageContent from './HelpCenterPageContent.jsx';

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/hy/help']}>
      <Routes>
        <Route path="/:locale/help" element={<HelpCenterPageContent />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('HelpCenterPageContent (apps/web/src/modules/cms)', () => {
  test('renders the page heading and links to FAQ and Contact', () => {
    renderPage();
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    const hrefs = screen
      .getAllByRole('link')
      .map((link) => link.getAttribute('href'));
    expect(hrefs).toContain('/hy/faq');
    expect(hrefs).toContain('/hy/contact');
  });
});
