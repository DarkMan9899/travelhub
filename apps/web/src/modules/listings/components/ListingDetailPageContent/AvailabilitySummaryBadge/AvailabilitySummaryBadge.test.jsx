import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import AvailabilitySummaryBadge from './AvailabilitySummaryBadge.jsx';

describe('AvailabilitySummaryBadge (Listing Detail)', () => {
  test('renders a generic "Available" label with no count for AVAILABLE', () => {
    render(
      <AvailabilitySummaryBadge
        status="AVAILABLE"
        bookableUnitType="HOTEL_ROOM"
      />,
    );
    expect(screen.getByText('Հասանելի է')).toBeInTheDocument();
  });

  test('renders a type-specific low-stock label with the exact count for LOW', () => {
    render(
      <AvailabilitySummaryBadge
        status="LOW"
        remainingCount={2}
        bookableUnitType="HOTEL_ROOM"
      />,
    );
    expect(screen.getByText('Ընդամենը 2 սենյակ է մնացել')).toBeInTheDocument();
  });

  test('uses the tour-departure noun ("seats") for a TOUR_DEPARTURE low-stock unit', () => {
    render(
      <AvailabilitySummaryBadge
        status="LOW"
        remainingCount={5}
        bookableUnitType="TOUR_DEPARTURE"
      />,
    );
    expect(screen.getByText('5 տեղ հասանելի է')).toBeInTheDocument();
  });

  test('falls back to a generic low-stock label for an unrecognized unit type', () => {
    render(
      <AvailabilitySummaryBadge
        status="LOW"
        remainingCount={3}
        bookableUnitType="SOMETHING_NEW"
      />,
    );
    expect(screen.getByText('Ընդամենը 3 է մնացել')).toBeInTheDocument();
  });

  test('renders "Sold out" for SOLD_OUT, ignoring bookableUnitType', () => {
    render(
      <AvailabilitySummaryBadge
        status="SOLD_OUT"
        remainingCount={0}
        bookableUnitType="VEHICLE"
      />,
    );
    expect(screen.getByText('Սպառված է')).toBeInTheDocument();
  });
});
