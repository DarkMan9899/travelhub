import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ListingGallery from './ListingGallery.jsx';

const MEDIA = [
  {
    id: 1,
    media_type: 'IMAGE',
    url: 'https://example.test/full-1.jpg',
    thumbnail_url: 'https://example.test/thumb-1.jpg',
    position: 0,
  },
  {
    id: 2,
    media_type: 'IMAGE',
    url: 'https://example.test/full-2.jpg',
    thumbnail_url: 'https://example.test/thumb-2.jpg',
    position: 1,
  },
  {
    id: 3,
    media_type: 'DOCUMENT',
    url: 'https://example.test/brochure.pdf',
    position: 2,
  },
];

describe('ListingGallery (Listing Details)', () => {
  test('renders nothing when there is no visual media', () => {
    const { container } = render(<ListingGallery media={[]} title="Villa" />);
    expect(container).toBeEmptyDOMElement();
  });

  test('renders one thumbnail button per IMAGE/VIDEO item, excluding DOCUMENT', () => {
    render(<ListingGallery media={MEDIA} title="Villa" />);
    expect(screen.getAllByRole('button')).toHaveLength(2);
  });

  test('clicking a thumbnail opens the lightbox on that image', async () => {
    const user = userEvent.setup();
    render(<ListingGallery media={MEDIA} title="Villa" />);

    await user.click(
      screen.getByRole('button', { name: 'Դիտել լուսանկար 2-ը 2-ից' }),
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText('2 2-ից')).toBeInTheDocument();
  });

  test('the next/previous buttons cycle through images with wraparound', async () => {
    const user = userEvent.setup();
    render(<ListingGallery media={MEDIA} title="Villa" />);

    await user.click(
      screen.getByRole('button', { name: 'Դիտել լուսանկար 1-ը 2-ից' }),
    );
    expect(screen.getByText('1 2-ից')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Հաջորդ լուսանկարը' }));
    expect(screen.getByText('2 2-ից')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Հաջորդ լուսանկարը' }));
    expect(screen.getByText('1 2-ից')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Նախորդ լուսանկարը' }));
    expect(screen.getByText('2 2-ից')).toBeInTheDocument();
  });

  test('arrow keys navigate while the lightbox is open', async () => {
    const user = userEvent.setup();
    render(<ListingGallery media={MEDIA} title="Villa" />);

    await user.click(
      screen.getByRole('button', { name: 'Դիտել լուսանկար 1-ը 2-ից' }),
    );
    await user.keyboard('{ArrowRight}');
    expect(screen.getByText('2 2-ից')).toBeInTheDocument();
    await user.keyboard('{ArrowLeft}');
    expect(screen.getByText('1 2-ից')).toBeInTheDocument();
  });

  test('Escape closes the lightbox', async () => {
    const user = userEvent.setup();
    render(<ListingGallery media={MEDIA} title="Villa" />);

    await user.click(
      screen.getByRole('button', { name: 'Դիտել լուսանկար 1-ը 2-ից' }),
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('thumbnail alt text prefers alt_text, then caption, then a generated fallback', () => {
    render(
      <ListingGallery
        media={[
          { ...MEDIA[0], alt_text: 'Sea-view balcony at sunset' },
          { ...MEDIA[1], alt_text: null, caption: 'Rooftop pool' },
        ]}
        title="Villa"
      />,
    );

    expect(
      screen.getByAltText('Sea-view balcony at sunset'),
    ).toBeInTheDocument();
    expect(screen.getByAltText('Rooftop pool')).toBeInTheDocument();
  });

  test('falls back to a title/index-derived alt text when neither alt_text nor caption exist', () => {
    render(<ListingGallery media={MEDIA} title="Villa" />);

    expect(screen.getByAltText('Villa — լուսանկար 1/2')).toBeInTheDocument();
    expect(screen.getByAltText('Villa — լուսանկար 2/2')).toBeInTheDocument();
  });
});
