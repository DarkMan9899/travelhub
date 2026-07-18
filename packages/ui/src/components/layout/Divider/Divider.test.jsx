import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Divider from './Divider.jsx';

describe('Divider (layout primitive)', () => {
  test('renders a native separator, horizontal by default', () => {
    render(<Divider />);
    const divider = screen.getByRole('separator');
    expect(divider.tagName).toBe('HR');
    expect(divider).toHaveAttribute('aria-orientation', 'horizontal');
  });

  test('supports a vertical orientation', () => {
    render(<Divider orientation="vertical" />);
    expect(screen.getByRole('separator')).toHaveAttribute(
      'aria-orientation',
      'vertical',
    );
  });
});
