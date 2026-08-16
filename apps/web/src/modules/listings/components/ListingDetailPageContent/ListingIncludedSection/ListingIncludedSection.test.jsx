import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ListingIncludedSection from './ListingIncludedSection.jsx';

describe('ListingIncludedSection (Phase 18)', () => {
  test('renders nothing when there are no items', () => {
    const { container } = render(<ListingIncludedSection items={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  test('renders the heading and both included/excluded items', () => {
    render(
      <ListingIncludedSection
        items={[
          { item_text: 'Airport pickup', is_included: true },
          { item_text: 'Lunch', is_included: false },
        ]}
        sectionId="included"
      />,
    );
    expect(
      screen.getByRole('heading', { name: 'Ինչ է ներառված' }),
    ).toHaveAttribute('id', 'included');
    expect(screen.getByText('Airport pickup')).toBeInTheDocument();
    expect(screen.getByText('Lunch')).toBeInTheDocument();
  });
});
