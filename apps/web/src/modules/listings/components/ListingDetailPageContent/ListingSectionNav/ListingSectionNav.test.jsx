import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ListingSectionNav from './ListingSectionNav.jsx';

describe('ListingSectionNav (Phase 18)', () => {
  test('renders nothing when there are no sections', () => {
    const { container } = render(<ListingSectionNav sections={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  test('renders one anchor link per section, in order', () => {
    render(
      <ListingSectionNav
        sections={[
          { id: 'about', label: 'About' },
          { id: 'amenities', label: 'Amenities' },
        ]}
      />,
    );
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute('href', '#about');
    expect(links[1]).toHaveAttribute('href', '#amenities');
  });
});
