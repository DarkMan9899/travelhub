import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import RecommendationsSection from './RecommendationsSection.jsx';
import { useRecommendationsQuery } from '../../queries/useRecommendationsQuery.js';

vi.mock('../../queries/useRecommendationsQuery.js', () => ({
  useRecommendationsQuery: vi.fn(),
}));

function renderSection() {
  return render(
    <MemoryRouter initialEntries={['/hy/account']}>
      <Routes>
        <Route path="/:locale/account" element={<RecommendationsSection />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('RecommendationsSection (apps/web/src/modules/ai)', () => {
  beforeEach(() => {
    useRecommendationsQuery.mockReset();
  });

  test('renders nothing for a user with no affinity signal yet', () => {
    useRecommendationsQuery.mockReturnValue({
      data: { data: { listings: [], blurb: null, based_on: null } },
      isPending: false,
      isError: false,
    });
    const { container } = renderSection();
    expect(container).toBeEmptyDOMElement();
  });

  test('renders nothing on error, never a broken/error UI on the dashboard', () => {
    useRecommendationsQuery.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
    });
    const { container } = renderSection();
    expect(container).toBeEmptyDOMElement();
  });

  test('renders the real recommended listings and blurb', () => {
    useRecommendationsQuery.mockReturnValue({
      data: {
        data: {
          listings: [
            {
              id: 1,
              title: 'Central Hotel',
              city_name: 'Yerevan',
              price_amount: '100.00',
              currency_code: 'AMD',
            },
          ],
          blurb: 'Here are some hotels in Yerevan you might like.',
          based_on: { category: 'Hotels', city: 'Yerevan' },
        },
      },
      isPending: false,
      isError: false,
    });
    renderSection();

    expect(screen.getByText('Առաջարկվում է ձեզ համար')).toBeInTheDocument();
    expect(
      screen.getByText('Here are some hotels in Yerevan you might like.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Central Hotel')).toBeInTheDocument();
    expect(screen.getByText('Yerevan')).toBeInTheDocument();
  });

  test('renders a "based on" caption naming the category/city/typical budget signals used', () => {
    useRecommendationsQuery.mockReturnValue({
      data: {
        data: {
          listings: [
            {
              id: 1,
              title: 'Central Hotel',
              city_name: 'Yerevan',
              price_amount: '100.00',
              currency_code: 'AMD',
            },
          ],
          blurb: null,
          based_on: {
            category: 'Hotels',
            city: 'Yerevan',
            typical_budget: { amount: 80, currency: 'AMD' },
          },
        },
      },
      isPending: false,
      isError: false,
    });
    renderSection();

    expect(
      screen.getByText('Հիմնված է՝', { exact: false }),
    ).toBeInTheDocument();
    expect(screen.getByText('Hotels', { exact: false })).toBeInTheDocument();
    expect(
      screen.getByText('Yerevan քաղաքում', { exact: false }),
    ).toBeInTheDocument();
    expect(screen.getByText(/80 AMD/, { exact: false })).toBeInTheDocument();
  });

  test('omits the "based on" caption when the backend returns no signal breakdown', () => {
    useRecommendationsQuery.mockReturnValue({
      data: {
        data: {
          listings: [{ id: 1, title: 'Central Hotel' }],
          blurb: null,
          based_on: { category: null, city: null, typical_budget: null },
        },
      },
      isPending: false,
      isError: false,
    });
    renderSection();

    expect(screen.queryByText('Հիմնված է՝', { exact: false })).toBeNull();
  });
});
