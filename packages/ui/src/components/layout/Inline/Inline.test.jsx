import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Inline from './Inline.jsx';

describe('Inline (layout primitive)', () => {
  test('renders a div by default, containing its children', () => {
    const { container } = render(
      <Inline>
        <span>One</span>
        <span>Two</span>
      </Inline>,
    );
    expect(container.firstChild.tagName).toBe('DIV');
    expect(screen.getByText('One')).toBeInTheDocument();
  });

  test('is polymorphic via the `as` prop', () => {
    render(
      <Inline as="nav" aria-label="Breadcrumb">
        <span>Home</span>
      </Inline>,
    );
    expect(
      screen.getByRole('navigation', { name: 'Breadcrumb' }),
    ).toBeInTheDocument();
  });

  test('wraps by default and can opt out of wrapping', () => {
    const { container: wrapped } = render(<Inline>x</Inline>);
    const { container: nowrap } = render(<Inline wrap={false}>x</Inline>);
    expect(wrapped.firstChild.className).not.toBe(nowrap.firstChild.className);
  });

  test('forwards arbitrary HTML attributes to the underlying element', () => {
    render(<Inline data-testid="my-inline">x</Inline>);
    expect(screen.getByTestId('my-inline')).toBeInTheDocument();
  });
});
