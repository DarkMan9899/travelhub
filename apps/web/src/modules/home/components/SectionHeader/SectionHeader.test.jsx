import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SectionHeader from './SectionHeader.jsx';

describe('SectionHeader (apps/web/src/modules/home)', () => {
  test('renders the title as a level-2 heading', () => {
    render(<SectionHeader title="Featured destinations" />);
    expect(
      screen.getByRole('heading', { level: 2, name: 'Featured destinations' }),
    ).toBeInTheDocument();
  });

  test('renders an optional eyebrow and subtitle', () => {
    render(
      <SectionHeader
        eyebrow="Explore"
        title="Featured destinations"
        subtitle="Curated places to visit."
      />,
    );
    expect(screen.getByText('Explore')).toBeInTheDocument();
    expect(screen.getByText('Curated places to visit.')).toBeInTheDocument();
  });

  test('renders a "view all" link only when both href and label are given', () => {
    const { rerender } = render(
      <SectionHeader title="Featured destinations" />,
    );
    expect(screen.queryByRole('link')).not.toBeInTheDocument();

    rerender(
      <MemoryRouter>
        <SectionHeader
          title="Featured destinations"
          viewAllHref="/en/search"
          viewAllLabel="View all"
        />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'View all' })).toHaveAttribute(
      'href',
      '/en/search',
    );
  });
});
