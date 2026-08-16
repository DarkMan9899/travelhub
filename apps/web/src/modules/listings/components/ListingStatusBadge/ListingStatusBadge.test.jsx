import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ListingStatusBadge from './ListingStatusBadge.jsx';

describe('ListingStatusBadge (apps/web/src/modules/listings)', () => {
  test('renders a translated label for a known status', () => {
    render(<ListingStatusBadge status="PUBLISHED" />);
    expect(screen.getByText('Հրապարակված')).toBeInTheDocument();
  });

  test('falls back to the raw code for an unknown status', () => {
    render(<ListingStatusBadge status="SOMETHING_NEW" />);
    expect(screen.getByText('SOMETHING_NEW')).toBeInTheDocument();
  });
});
