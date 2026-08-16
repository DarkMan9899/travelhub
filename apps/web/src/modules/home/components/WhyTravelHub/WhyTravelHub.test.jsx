import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import WhyTravelHub from './WhyTravelHub.jsx';
import WHY_TRAVEL_HUB_ITEMS from '../../constants/whyTravelHub.js';

describe('WhyTravelHub (apps/web/src/modules/home)', () => {
  test('renders a labeled section landmark with one heading per value item', () => {
    render(<WhyTravelHub />);
    expect(screen.getByRole('region')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(
      WHY_TRAVEL_HUB_ITEMS.length,
    );
  });
});
