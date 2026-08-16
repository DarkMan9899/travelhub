import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ListingAmenitiesSection from './ListingAmenitiesSection.jsx';

describe('ListingAmenitiesSection (Listing Details)', () => {
  test('renders nothing when the category has no amenity groups', () => {
    const { container } = render(
      <ListingAmenitiesSection amenityGroups={[]} amenityIds={[]} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  test('renders nothing when none of the listing amenity_ids match this category', () => {
    const { container } = render(
      <ListingAmenitiesSection
        amenityGroups={[
          { code: 'CONNECTIVITY', amenities: [{ value: 1, code: 'WiFi' }] },
        ]}
        amenityIds={[999]}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  test('groups matched amenities under their translated group heading', () => {
    render(
      <ListingAmenitiesSection
        amenityGroups={[
          { code: 'CONNECTIVITY', amenities: [{ value: 1, code: 'WiFi' }] },
          { code: 'WELLNESS', amenities: [{ value: 2, code: 'Pool' }] },
        ]}
        amenityIds={[1]}
      />,
    );
    expect(
      screen.getByRole('heading', { name: 'Ինտերնետ և կապ' }),
    ).toBeInTheDocument();
    expect(screen.getByText('WiFi')).toBeInTheDocument();
    expect(screen.queryByText('Pool')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Առողջություն' }),
    ).not.toBeInTheDocument();
  });
});
