import { describe, test, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import NotFoundPage from './NotFoundPage.jsx';

afterEach(() => {
  cleanup();
  document.querySelector('meta[name="robots"]')?.remove();
});

describe('NotFoundPage', () => {
  test('sets a noindex,nofollow robots meta tag so a crawler reaching a 404 never indexes it', () => {
    render(
      <MemoryRouter>
        <NotFoundPage />
      </MemoryRouter>,
    );

    const meta = document.querySelector('meta[name="robots"]');
    expect(meta).not.toBeNull();
    expect(meta.getAttribute('content')).toBe('noindex, nofollow');
  });

  test('removes the noindex tag it created on unmount', () => {
    const { unmount } = render(
      <MemoryRouter>
        <NotFoundPage />
      </MemoryRouter>,
    );
    expect(document.querySelector('meta[name="robots"]')).not.toBeNull();

    unmount();

    expect(document.querySelector('meta[name="robots"]')).toBeNull();
  });
});
