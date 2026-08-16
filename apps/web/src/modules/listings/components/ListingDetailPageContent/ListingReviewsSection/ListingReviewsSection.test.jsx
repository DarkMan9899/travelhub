import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ListingReviewsSection from './ListingReviewsSection.jsx';

vi.mock('../../../../reviews/index.js', () => ({
  // eslint-disable-next-line react/prop-types -- trivial test double
  ReviewsList: ({ listingId }) => <div>Reviews for {listingId}</div>,
}));

describe('ListingReviewsSection (Phase 18)', () => {
  test('shows an honest "no reviews" state instead of a fabricated summary when ratingAverage is null', () => {
    render(
      <ListingReviewsSection
        listingId={5}
        ratingAverage={null}
        reviewCount={0}
        sectionId="reviews"
      />,
    );
    expect(screen.getByRole('heading', { name: 'Կարծիքներ' })).toHaveAttribute(
      'id',
      'reviews',
    );
    expect(screen.queryByText('0.0')).not.toBeInTheDocument();
    expect(screen.getByText('Reviews for 5')).toBeInTheDocument();
  });

  test('shows the ReviewSummary primitive when a real aggregate exists', () => {
    render(
      <ListingReviewsSection
        listingId={5}
        ratingAverage={4.2}
        reviewCount={9}
      />,
    );
    expect(screen.getByText('4.2')).toBeInTheDocument();
  });
});
