import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import FaqPageContent from './FaqPageContent.jsx';

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/hy/faq']}>
      <Routes>
        <Route path="/:locale/faq" element={<FaqPageContent />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('FaqPageContent (apps/web/src/modules/cms)', () => {
  test('renders the page heading and five collapsible questions', () => {
    const { container } = renderPage();
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(container.querySelectorAll('details')).toHaveLength(5);
  });
});
