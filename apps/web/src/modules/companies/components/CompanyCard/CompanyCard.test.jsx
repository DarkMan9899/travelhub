import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import CompanyCard from './CompanyCard.jsx';

const COMPANY = {
  id: 1,
  slug: 'yerevan-boutique-hospitality',
  display_name: 'Yerevan Boutique Hospitality',
  description: 'A boutique hospitality partner in Yerevan.',
  logo_url: 'https://cdn.example/logo.png',
  cover_url: 'https://cdn.example/cover.png',
  listing_count: 4,
  is_verified: true,
};

function renderCard(company = COMPANY) {
  return render(
    <MemoryRouter initialEntries={['/hy/companies']}>
      <Routes>
        <Route
          path="/:locale/companies"
          element={<CompanyCard company={company} />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('CompanyCard (apps/web/src/modules/companies)', () => {
  test('links to the company profile route by slug', () => {
    renderCard();
    expect(
      screen.getByRole('link', { name: /Yerevan Boutique Hospitality/ }),
    ).toHaveAttribute('href', '/hy/companies/yerevan-boutique-hospitality');
  });

  test('renders the display name and description', () => {
    renderCard();
    expect(
      screen.getByText('Yerevan Boutique Hospitality'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('A boutique hospitality partner in Yerevan.'),
    ).toBeInTheDocument();
  });

  test('shows a verified indicator only when is_verified is true', () => {
    // The test harness's i18n instance defaults to Armenian
    // (tests/setup.js) — real "companies.card.verified" content.
    renderCard({ ...COMPANY, is_verified: false });
    expect(screen.queryByLabelText('Ստուգված')).not.toBeInTheDocument();

    renderCard(COMPANY);
    expect(screen.getByLabelText('Ստուգված')).toBeInTheDocument();
  });

  test('falls back to a placeholder when there is no cover image', () => {
    const { container } = renderCard({ ...COMPANY, cover_url: null });
    // The logo (decorative, alt="") still renders as a plain <img> —
    // deliberately excluded from the accessibility tree's "img" role
    // (empty-alt maps to role="presentation" per HTML-AAM), so this
    // checks the DOM directly rather than via a role query.
    expect(container.querySelector('img[src]')).not.toBeNull();
    expect(
      container.querySelector(`[class*="imagePlaceholder"]`),
    ).not.toBeNull();
  });
});
