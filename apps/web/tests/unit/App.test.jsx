/**
 * Sprint 1 scope: proves the component-test harness itself works
 * end-to-end (jsdom environment, React Testing Library, the provider
 * tree, react-router, i18next) before any real feature exists to test —
 * the frontend equivalent of apps/api's AppError.test.js harness proof.
 */

import { describe, test, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import App from '../../src/app/App.jsx';

describe('App bootstrap (FRONTEND_ARCHITECTURE.md §3-4)', () => {
  test('renders the placeholder page under the default locale redirect', async () => {
    window.history.pushState({}, '', '/');
    render(<App />);

    await waitFor(() => {
      expect(window.location.pathname).toBe('/hy');
    });
  });

  test('renders a 404 for an unsupported locale segment', async () => {
    window.history.pushState({}, '', '/xx');
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('404')).toBeInTheDocument();
    });
  });
});
