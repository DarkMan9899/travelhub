import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Stack from './Stack.jsx';

describe('Stack (layout primitive)', () => {
  test('renders a div by default, containing its children', () => {
    const { container } = render(
      <Stack>
        <span>One</span>
        <span>Two</span>
      </Stack>,
    );
    expect(container.firstChild.tagName).toBe('DIV');
    expect(screen.getByText('One')).toBeInTheDocument();
    expect(screen.getByText('Two')).toBeInTheDocument();
  });

  test('is polymorphic via the `as` prop, rendering semantic elements', () => {
    render(
      <Stack as="ul" aria-label="Amenities">
        <li>Wi-Fi</li>
      </Stack>,
    );
    expect(screen.getByRole('list', { name: 'Amenities' })).toBeInTheDocument();
  });

  test('applies a distinct class per gap value', () => {
    const { container: gap1 } = render(<Stack gap="1">x</Stack>);
    const { container: gap8 } = render(<Stack gap="8">x</Stack>);
    expect(gap1.firstChild.className).not.toBe(gap8.firstChild.className);
  });

  test('forwards arbitrary HTML attributes to the underlying element', () => {
    render(<Stack data-testid="my-stack">x</Stack>);
    expect(screen.getByTestId('my-stack')).toBeInTheDocument();
  });
});
