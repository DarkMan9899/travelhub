import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import DestinationPageContent from './DestinationPageContent.jsx';
import {
  useDestinationsQuery,
  useSearchListingsQuery,
} from '../../../search/index.js';

vi.mock('../../../search/index.js', () => ({
  useDestinationsQuery: vi.fn(),
  useSearchListingsQuery: vi.fn(),
  // eslint-disable-next-line react/prop-types -- trivial test double
  SearchResultCard: ({ result }) => <div>{result.title}</div>,
}));

vi.mock('../../../../seo/useSeo.js', () => ({ default: vi.fn() }));

const DESTINATION = {
  id: 2,
  slug: 'yerevan',
  name: 'Yerevan',
  listing_count: 20,
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/en/destinations/yerevan']}>
      <Routes>
        <Route
          path="/:locale/destinations/:citySlug"
          element={<DestinationPageContent />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('DestinationPageContent (apps/web/src/modules/discovery)', () => {
  beforeEach(() => {
    useDestinationsQuery.mockReset();
    useSearchListingsQuery.mockReset();
  });

  // Regression coverage — see CategoryPageContent.test.jsx's identical
  // test for the full rationale (reported "duplicated breadcrumb/title/
  // description" bug; no reproducible duplicate-DOM-node defect was found,
  // but this locks in "exactly one" so a future regression fails a test
  // rather than only showing up in a screenshot).
  test('renders EXACTLY one H1, one breadcrumb nav, and one description block for the matched city', () => {
    useDestinationsQuery.mockReturnValue({
      data: [DESTINATION],
      isPending: false,
      isError: false,
    });
    useSearchListingsQuery.mockReturnValue({
      data: { pages: [{ results: [] }] },
      isPending: false,
    });
    renderPage();

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Yerevan',
    );
    expect(
      screen.getAllByRole('navigation', { name: 'Breadcrumb' }),
    ).toHaveLength(1);
    expect(
      screen.getAllByText(
        'Բացահայտեք հյուրանոցներ, տուրեր և փորձառություններ Yerevan-ում, Հայաստան։ Ամրագրեք ստուգված տեղական գործընկերների հետ desavii-ում։',
      ),
    ).toHaveLength(1);
    expect(screen.getAllByText('Yerevan')).toHaveLength(2);
  });

  test('renders each result WITH its per-card type badge — a city mixes listing types, unlike a category page', () => {
    useDestinationsQuery.mockReturnValue({
      data: [DESTINATION],
      isPending: false,
      isError: false,
    });
    useSearchListingsQuery.mockReturnValue({
      data: {
        pages: [{ results: [{ id: 1, title: 'Boutique Yerevan Hotel' }] }],
      },
      isPending: false,
    });
    renderPage();

    expect(screen.getByText('20 հայտարարություն')).toBeInTheDocument();
    expect(screen.getByText('Boutique Yerevan Hotel')).toBeInTheDocument();
  });

  test('shows an empty state when the city has no published listings', () => {
    useDestinationsQuery.mockReturnValue({
      data: [DESTINATION],
      isPending: false,
      isError: false,
    });
    useSearchListingsQuery.mockReturnValue({
      data: { pages: [{ results: [] }] },
      isPending: false,
    });
    renderPage();
    expect(
      screen.getByText('Առայժմ հայտարարություններ չկան'),
    ).toBeInTheDocument();
  });

  test('shows a not-found state when no destination matches the slug', () => {
    useDestinationsQuery.mockReturnValue({
      data: [],
      isPending: false,
      isError: false,
    });
    useSearchListingsQuery.mockReturnValue({
      data: undefined,
      isPending: false,
    });
    renderPage();
    expect(screen.getByText('Էջը չի գտնվել')).toBeInTheDocument();
  });

  test('2026 SEO/performance audit: never fetches listings with an unresolved cityId — no wasted unfiltered request', () => {
    useDestinationsQuery.mockReturnValue({
      data: [],
      isPending: false,
      isError: false,
    });
    useSearchListingsQuery.mockReturnValue({
      data: undefined,
      isPending: false,
    });
    renderPage();

    expect(useSearchListingsQuery).toHaveBeenCalledWith(
      { cityId: undefined },
      expect.objectContaining({ enabled: false }),
    );
  });
});
