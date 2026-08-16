import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import BlogPageContent from './BlogPageContent.jsx';

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/hy/blog']}>
      <Routes>
        <Route path="/:locale/blog" element={<BlogPageContent />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('BlogPageContent (apps/web/src/modules/cms)', () => {
  test('renders the page heading and an honest coming-soon empty state', () => {
    renderPage();
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    // The empty state's title is the real Armenian "coming soon" string
    // (tests/setup.js defaults the i18n instance to Armenian).
    expect(screen.getByText('Շուտով')).toBeInTheDocument();
  });
});
