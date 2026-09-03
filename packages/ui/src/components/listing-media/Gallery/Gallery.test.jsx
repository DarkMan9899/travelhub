import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Gallery from './Gallery.jsx';

const MEDIA = [
  {
    id: 1,
    url: 'https://example.test/cover.jpg',
    mediaType: 'IMAGE',
    alt: 'Cover',
  },
  {
    id: 2,
    url: 'https://example.test/second.jpg',
    mediaType: 'IMAGE',
    alt: 'Second',
  },
  {
    id: 3,
    url: 'https://example.test/third.jpg',
    mediaType: 'IMAGE',
    alt: 'Third',
  },
];

function renderGallery(media = MEDIA) {
  return render(
    <Gallery
      media={media}
      viewImageLabel="View photo"
      viewAllLabel={(count) => `View all ${count} photos`}
      closeLabel="Close"
      previousLabel="Previous"
      nextLabel="Next"
    />,
  );
}

describe('Gallery (packages/ui/listing-media)', () => {
  test('renders one thumbnail button per media item', () => {
    renderGallery();
    expect(screen.getAllByRole('button')).toHaveLength(3);
  });

  // 2026 SEO/performance audit: real Lighthouse trace evidence identified
  // this component's cover tile (index 0) as the actual LCP element on
  // Listing Detail — this is `ListingHero`'s only current consumer, and
  // the cover tile is always this gallery's most prominent above-the-fold
  // image, so it must never be lazy-loaded like the rest.
  test('the cover tile (index 0) loads eagerly with high fetch priority — every other thumbnail stays lazy', () => {
    renderGallery();
    const images = screen.getAllByRole('img');
    expect(images[0]).toHaveAttribute('loading', 'eager');
    expect(images[0]).toHaveAttribute('fetchpriority', 'high');
    expect(images[1]).toHaveAttribute('loading', 'lazy');
    expect(images[1]).not.toHaveAttribute('fetchpriority');
    expect(images[2]).toHaveAttribute('loading', 'lazy');
  });
});
