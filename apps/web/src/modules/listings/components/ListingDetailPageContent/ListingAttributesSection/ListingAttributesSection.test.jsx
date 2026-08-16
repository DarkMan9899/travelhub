import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ListingAttributesSection from './ListingAttributesSection.jsx';

describe('ListingAttributesSection (Listing Details)', () => {
  test('renders nothing when the category has no attributes', () => {
    const { container } = render(
      <ListingAttributesSection
        attributes={[]}
        listing={{ attribute_values: [] }}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  test('renders nothing when none of the attributes have a listing value', () => {
    const { container } = render(
      <ListingAttributesSection
        attributes={[{ code: 'bedrooms', data_type: 'INTEGER', unit: 'rooms' }]}
        listing={{ attribute_values: [] }}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  test('renders the heading and value once the listing has at least one attribute value', () => {
    render(
      <ListingAttributesSection
        attributes={[{ code: 'bedrooms', data_type: 'INTEGER', unit: 'rooms' }]}
        listing={{ attribute_values: [{ code: 'bedrooms', value: '3' }] }}
      />,
    );
    expect(
      screen.getByRole('heading', { name: 'Մանրամասներ' }),
    ).toBeInTheDocument();
    expect(screen.getByText('3 սենյակ')).toBeInTheDocument();
  });

  test('renders a category-appropriate ENUM attribute (a different category than the INTEGER one above)', () => {
    render(
      <ListingAttributesSection
        attributes={[
          {
            code: 'difficulty',
            data_type: 'ENUM',
            options: [{ value: 1, code: 'EASY' }],
          },
        ]}
        listing={{
          attribute_values: [{ code: 'difficulty', option_codes: ['EASY'] }],
        }}
      />,
    );
    expect(screen.getByText('Հեշտ')).toBeInTheDocument();
  });
});
