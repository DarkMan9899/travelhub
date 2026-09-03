import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ErrorBoundary from './ErrorBoundary.jsx';

// Redesign phase (2026, i18n remediation) — the fallback UI used to be
// two hardcoded English strings, shown to every locale whenever a render
// error is caught; this test locks in the real fix, not a mock.
function Bomb() {
  throw new Error('boom');
}

describe('ErrorBoundary (apps/web/src/errors)', () => {
  test('renders localized fallback copy (not hardcoded English) when a child throws', () => {
    // The boundary logs via console.error — expected here, not a real
    // failure; silenced so the test output stays readable.
    vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    );

    // The shared test i18n instance defaults to `hy` (tests/setup.js) —
    // asserting the Armenian copy (not the old hardcoded English) is
    // what actually proves this reads from the translation resources.
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Տեղի ունեցավ անսպասելի սխալ',
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Խնդրում ենք թարմացնել էջը',
    );
  });

  test('renders children normally when nothing throws', () => {
    render(
      <ErrorBoundary>
        <p>Safe content</p>
      </ErrorBoundary>,
    );

    expect(screen.getByText('Safe content')).toBeInTheDocument();
  });
});
