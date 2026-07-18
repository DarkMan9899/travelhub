import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Spinner from './Spinner.jsx';

describe('Spinner (COMPONENT_LIBRARY.md Part II §4)', () => {
  test('exposes role="status" with a default "Loading" accessible name', () => {
    render(<Spinner />);
    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument();
  });

  test('accepts a custom label for context-specific announcements', () => {
    render(<Spinner label="Processing payment" />);
    expect(
      screen.getByRole('status', { name: 'Processing payment' }),
    ).toBeInTheDocument();
  });

  test('supports every documented size without throwing', () => {
    ['sm', 'md', 'lg'].forEach((size) => {
      const { unmount } = render(<Spinner size={size} />);
      expect(screen.getByRole('status')).toBeInTheDocument();
      unmount();
    });
  });

  test('decorative mode drops the status role for composition inside an already-busy host (e.g. Button)', () => {
    render(<Spinner decorative />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
