import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Container from './Container.jsx';

describe('Container (layout primitive)', () => {
  test('renders a div by default, containing its children', () => {
    const { container } = render(<Container>Content</Container>);
    expect(container.firstChild.tagName).toBe('DIV');
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  test('is polymorphic via the `as` prop', () => {
    render(
      <Container as="main" aria-label="Page content">
        Content
      </Container>,
    );
    expect(
      screen.getByRole('main', { name: 'Page content' }),
    ).toBeInTheDocument();
  });

  test('supports every documented size without throwing', () => {
    ['content', 'wide', 'narrow', 'full'].forEach((size) => {
      const { unmount } = render(<Container size={size}>x</Container>);
      expect(screen.getByText('x')).toBeInTheDocument();
      unmount();
    });
  });
});
