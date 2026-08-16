import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ItineraryView from './ItineraryView.jsx';

const PLAN = {
  destination: 'Yerevan',
  days: 2,
  currency: 'AMD',
  narrative: 'Enjoy Central Hotel and more.',
  total_estimated_budget: 150,
  daily_plan: [
    {
      day: 1,
      listings: [
        {
          id: 1,
          title: 'Central Hotel',
          city_name: 'Yerevan',
          price_per_night: 100,
          currency: 'AMD',
        },
      ],
    },
    { day: 2, listings: [] },
  ],
};

describe('ItineraryView (apps/web/src/modules/ai)', () => {
  test('renders the narrative and every real listing from the daily plan', () => {
    render(<ItineraryView plan={PLAN} />);
    expect(
      screen.getByText('Enjoy Central Hotel and more.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Central Hotel')).toBeInTheDocument();
    expect(screen.getAllByText('Yerevan').length).toBeGreaterThan(0);
  });

  test('renders an empty-day state when a day has no assigned listings', () => {
    render(<ItineraryView plan={PLAN} />);
    expect(
      screen.getByText('Հայտարարություններ դեռ նշանակված չեն'),
    ).toBeInTheDocument();
  });
});
