import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ListingGrid from './ListingGrid.jsx';

describe('ListingGrid (apps/web/src/components)', () => {
  test('renders its children', () => {
    render(
      <ListingGrid>
        <p>Card one</p>
        <p>Card two</p>
      </ListingGrid>,
    );
    expect(screen.getByText('Card one')).toBeInTheDocument();
    expect(screen.getByText('Card two')).toBeInTheDocument();
  });
});
