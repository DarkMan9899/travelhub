import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Badge from './Badge.jsx';

describe('Badge (COMPONENT_LIBRARY.md Part II §1)', () => {
  test('always renders visible label text, never color alone', () => {
    render(<Badge variant="success" label="Confirmed" />);
    expect(screen.getByText('Confirmed')).toBeInTheDocument();
  });

  test('supports every documented variant without throwing', () => {
    ['success', 'warning', 'danger', 'neutral', 'info'].forEach((variant) => {
      const { unmount } = render(<Badge variant={variant} label="Status" />);
      expect(screen.getByText('Status')).toBeInTheDocument();
      unmount();
    });
  });

  test('supports both sizes and the filled/unfilled toggle without throwing', () => {
    ['sm', 'md'].forEach((size) => {
      [true, false].forEach((filled) => {
        const { unmount } = render(
          <Badge label="Verified" size={size} filled={filled} />,
        );
        expect(screen.getByText('Verified')).toBeInTheDocument();
        unmount();
      });
    });
  });
});
