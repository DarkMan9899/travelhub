import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Grid from './Grid.jsx';

describe('Grid (layout primitive)', () => {
  test('renders a div by default, containing its children', () => {
    const { container } = render(<Grid>Content</Grid>);
    expect(container.firstChild.tagName).toBe('DIV');
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  test('is polymorphic via the `as` prop', () => {
    render(
      <Grid as="ul" aria-label="Listings">
        <li>Item</li>
      </Grid>,
    );
    expect(screen.getByRole('list', { name: 'Listings' })).toBeInTheDocument();
  });

  test('a fixed columns count sets the --grid-columns custom property', () => {
    const { container } = render(<Grid columns={3}>x</Grid>);
    expect(container.firstChild.style.getPropertyValue('--grid-columns')).toBe(
      '3',
    );
  });

  test('the default "auto" columns mode sets no custom property', () => {
    const { container } = render(<Grid>x</Grid>);
    expect(container.firstChild.style.getPropertyValue('--grid-columns')).toBe(
      '',
    );
  });

  test('merges a caller-supplied style with the internal custom property', () => {
    const { container } = render(
      <Grid columns={2} style={{ color: 'red' }}>
        x
      </Grid>,
    );
    expect(container.firstChild.style.color).toBe('red');
    expect(container.firstChild.style.getPropertyValue('--grid-columns')).toBe(
      '2',
    );
  });
});
