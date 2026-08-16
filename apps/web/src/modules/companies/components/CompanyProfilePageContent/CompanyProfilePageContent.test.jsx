import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import CompanyProfilePageContent from './CompanyProfilePageContent.jsx';
import { useCompanyQuery } from '../../queries/useCompanyQuery.js';
import { useSearchListingsQuery } from '../../../search/index.js';

vi.mock('../../queries/useCompanyQuery.js', () => ({
  useCompanyQuery: vi.fn(),
  default: vi.fn(),
}));
vi.mock('../../../search/index.js', async () => {
  const actual = await vi.importActual('../../../search/index.js');
  return { ...actual, useSearchListingsQuery: vi.fn() };
});
vi.mock(
  '../../../favorites/components/FavoriteButton/FavoriteButton.jsx',
  () => ({
    default: () => null,
  }),
);

const COMPANY = {
  id: 1,
  slug: 'yerevan-boutique-hospitality',
  display_name: 'Yerevan Boutique Hospitality',
  description: 'A boutique hospitality partner.',
  logo_url: null,
  cover_url: null,
  listing_count: 2,
  is_verified: true,
  email: 'hello@example.com',
  phone: '+37411000000',
  website: 'https://example.com',
  social_links: {},
};

function renderPage() {
  return render(
    <MemoryRouter
      initialEntries={['/hy/companies/yerevan-boutique-hospitality']}
    >
      <Routes>
        <Route
          path="/:locale/companies/:slug"
          element={<CompanyProfilePageContent />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('CompanyProfilePageContent (apps/web/src/modules/companies)', () => {
  test('renders the company name and description on success', () => {
    useCompanyQuery.mockReturnValue({
      data: COMPANY,
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
    useSearchListingsQuery.mockReturnValue({
      data: { pages: [{ results: [] }] },
    });
    renderPage();

    expect(
      screen.getByRole('heading', { name: 'Yerevan Boutique Hospitality' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('A boutique hospitality partner.'),
    ).toBeInTheDocument();
    expect(screen.getByText('hello@example.com')).toBeInTheDocument();
  });

  test('renders a not-found EmptyState for a 404', () => {
    useCompanyQuery.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
      error: { status: 404 },
      refetch: vi.fn(),
    });
    useSearchListingsQuery.mockReturnValue({
      data: { pages: [{ results: [] }] },
    });
    renderPage();

    expect(
      screen.queryByRole('heading', { name: 'Yerevan Boutique Hospitality' }),
    ).not.toBeInTheDocument();
  });

  test('renders the company listings, reusing SearchResultCard', () => {
    useCompanyQuery.mockReturnValue({
      data: COMPANY,
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
    useSearchListingsQuery.mockReturnValue({
      data: {
        pages: [
          { results: [{ id: 9, listing_type: 'HOTEL', title: 'A room' }] },
        ],
      },
    });
    renderPage();

    expect(screen.getByRole('heading', { name: 'A room' })).toBeInTheDocument();
  });
});
