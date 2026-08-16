import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import RelatedListings from './RelatedListings.jsx';
import { useSearchListingsQuery } from '../../../../search/index.js';

vi.mock('../../../../search/index.js', () => ({
  useSearchListingsQuery: vi.fn(),
  // eslint-disable-next-line react/prop-types -- trivial test double
  SearchResultCard: ({ result }) => <div>{result.title}</div>,
}));

function renderWithRouter(ui) {
  return render(
    <MemoryRouter initialEntries={['/hy/listings/1']}>
      <Routes>
        <Route path="/:locale/listings/:id" element={ui} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('RelatedListings (Listing Details)', () => {
  beforeEach(() => {
    useSearchListingsQuery.mockReset();
  });

  test('renders nothing when there is no categoryId', () => {
    useSearchListingsQuery.mockReturnValue({ data: undefined });
    const { container } = renderWithRouter(
      <RelatedListings categoryId={undefined} excludeListingId={1} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  test('renders nothing when the category has no other listings', () => {
    useSearchListingsQuery.mockReturnValue({
      data: { pages: [{ results: [{ id: 1, title: 'This listing' }] }] },
    });
    const { container } = renderWithRouter(
      <RelatedListings categoryId={3} excludeListingId={1} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  test('renders same-category results, excluding the current listing', () => {
    useSearchListingsQuery.mockReturnValue({
      data: {
        pages: [
          {
            results: [
              { id: 1, title: 'This listing' },
              { id: 2, title: 'Another villa' },
            ],
          },
        ],
      },
    });
    renderWithRouter(<RelatedListings categoryId={3} excludeListingId={1} />);

    expect(
      screen.getByRole('heading', { name: 'Ձեզ նաև կարող է հետաքրքրել' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Another villa')).toBeInTheDocument();
    expect(screen.queryByText('This listing')).not.toBeInTheDocument();
  });
});
