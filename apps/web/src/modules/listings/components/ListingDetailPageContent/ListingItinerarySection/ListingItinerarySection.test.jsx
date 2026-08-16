import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ListingItinerarySection from './ListingItinerarySection.jsx';

describe('ListingItinerarySection (Phase 18)', () => {
  test('renders nothing when there are no steps', () => {
    const { container } = render(<ListingItinerarySection steps={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  test('renders the heading and each step title', () => {
    render(
      <ListingItinerarySection
        steps={[
          { title: 'Meet at the trailhead', duration_minutes: 30 },
          { title: 'Hike to the summit', description: 'A scenic climb.' },
        ]}
        sectionId="itinerary"
      />,
    );
    expect(screen.getByRole('heading', { name: 'Երթուղի' })).toHaveAttribute(
      'id',
      'itinerary',
    );
    expect(screen.getByText('Meet at the trailhead')).toBeInTheDocument();
    expect(screen.getByText('Hike to the summit')).toBeInTheDocument();
    expect(screen.getByText('A scenic climb.')).toBeInTheDocument();
  });
});
