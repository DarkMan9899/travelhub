import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ContactPageContent from './ContactPageContent.jsx';

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/hy/contact']}>
      <Routes>
        <Route path="/:locale/contact" element={<ContactPageContent />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ContactPageContent (apps/web/src/modules/cms)', () => {
  test('renders the page heading and support contact details', () => {
    renderPage();
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.getByText('support@desavii.com')).toBeInTheDocument();
    expect(screen.getByText('+374 10 000 000')).toBeInTheDocument();
  });

  test('renders no submission form — contact is intentionally static', () => {
    renderPage();
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
