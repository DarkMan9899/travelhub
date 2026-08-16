import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ListingHero from './ListingHero.jsx';

const MEDIA = [
  { id: 1, media_type: 'IMAGE', url: '/a.jpg', position: 0, alt_text: 'A' },
  { id: 2, media_type: 'IMAGE', url: '/b.jpg', position: 1, alt_text: 'B' },
];

describe('ListingHero (Phase 18)', () => {
  test('renders the title, location, and category', () => {
    render(
      <ListingHero
        media={MEDIA}
        title="Cozy Villa in Yerevan"
        categoryLabel="Villas"
        cityName="Yerevan"
        countryName="Armenia"
        reviewsAnchorId="reviews"
      />,
    );
    expect(
      screen.getByRole('heading', { name: 'Cozy Villa in Yerevan', level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByText('Villas')).toBeInTheDocument();
    expect(screen.getByText('Yerevan, Armenia')).toBeInTheDocument();
  });

  test('shows a "no reviews yet" message instead of a fabricated rating when ratingAverage is null', () => {
    render(
      <ListingHero
        media={MEDIA}
        title="Cozy Villa"
        ratingAverage={null}
        reviewsAnchorId="reviews"
      />,
    );
    expect(screen.getByText('Կարծիքներ դեռ չկան')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  test('links the rating to the reviews section anchor when a rating exists', () => {
    render(
      <ListingHero
        media={MEDIA}
        title="Cozy Villa"
        ratingAverage={4.5}
        reviewCount={12}
        reviewsAnchorId="reviews"
      />,
    );
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '#reviews');
    expect(screen.getByText('12 կարծիք')).toBeInTheDocument();
  });

  test('renders partner-authored highlights when present', () => {
    render(
      <ListingHero
        media={MEDIA}
        title="Cozy Villa"
        highlights={[{ icon_code: 'pool', text: 'Private pool' }]}
        reviewsAnchorId="reviews"
      />,
    );
    expect(screen.getByText('Private pool')).toBeInTheDocument();
  });

  test('renders nothing for the category/highlights/gallery when the data is absent', () => {
    const { container } = render(
      <ListingHero media={[]} title="Cozy Villa" reviewsAnchorId="reviews" />,
    );
    expect(container.querySelector('ul')).not.toBeInTheDocument();
  });

  test('renders the actions slot', () => {
    render(
      <ListingHero
        media={MEDIA}
        title="Cozy Villa"
        reviewsAnchorId="reviews"
        actions={<button type="button">Favorite</button>}
      />,
    );
    expect(
      screen.getByRole('button', { name: 'Favorite' }),
    ).toBeInTheDocument();
  });
});
