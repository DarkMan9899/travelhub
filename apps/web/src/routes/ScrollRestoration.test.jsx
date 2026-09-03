import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route, useNavigate } from 'react-router-dom';
import ScrollRestoration from './ScrollRestoration.jsx';

function PageA() {
  const navigate = useNavigate();
  return (
    <div>
      <h1>Page A</h1>
      <button type="button" onClick={() => navigate('/hy/page-b')}>
        Go to B
      </button>
      <button type="button" onClick={() => navigate('/hy/page-a?x=1')}>
        Change query
      </button>
      <button type="button" onClick={() => navigate('/en/page-a')}>
        Switch to EN
      </button>
      <div id="anchor">Anchor target</div>
    </div>
  );
}

function PageB() {
  const navigate = useNavigate();
  return (
    <div>
      <h1>Page B</h1>
      <button type="button" onClick={() => navigate(-1)}>
        Back
      </button>
    </div>
  );
}

function renderApp(initialPath) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <ScrollRestoration />
      <Routes>
        <Route path="/:locale/page-a" element={<PageA />} />
        <Route path="/:locale/page-b" element={<PageB />} />
      </Routes>
    </MemoryRouter>,
  );
}

function setScrollY(value) {
  Object.defineProperty(window, 'scrollY', {
    value,
    configurable: true,
  });
}

describe('ScrollRestoration (apps/web/src/routes)', () => {
  beforeEach(() => {
    window.scrollTo = vi.fn();
    Element.prototype.scrollIntoView = vi.fn();
    setScrollY(0);
  });

  test('scrolls to top on a genuine new-pathname navigation', async () => {
    const user = userEvent.setup();
    renderApp('/hy/page-a');
    window.scrollTo.mockClear();

    await user.click(screen.getByRole('button', { name: 'Go to B' }));

    await waitFor(() => {
      expect(window.scrollTo).toHaveBeenCalledWith(0, 0);
    });
  });

  test('does not scroll on a same-pathname query-only change', async () => {
    const user = userEvent.setup();
    renderApp('/hy/page-a');
    window.scrollTo.mockClear();

    await user.click(screen.getByRole('button', { name: 'Change query' }));
    await screen.findByText('Page A');

    expect(window.scrollTo).not.toHaveBeenCalled();
  });

  test('preserves scroll on a locale-only switch', async () => {
    const user = userEvent.setup();
    renderApp('/hy/page-a');
    window.scrollTo.mockClear();

    await user.click(screen.getByRole('button', { name: 'Switch to EN' }));
    await screen.findByText('Page A');

    expect(window.scrollTo).not.toHaveBeenCalled();
  });

  test('restores the saved scroll position on browser Back (POP)', async () => {
    const user = userEvent.setup();
    renderApp('/hy/page-a');

    setScrollY(1234);
    await user.click(screen.getByRole('button', { name: 'Go to B' }));
    await screen.findByText('Page B');

    window.scrollTo.mockClear();
    await user.click(screen.getByRole('button', { name: 'Back' }));
    await screen.findByText('Page A');

    await waitFor(() => {
      expect(window.scrollTo).toHaveBeenCalledWith(0, 1234);
    });
  });

  test('scrolls a hash target into view instead of resetting to top', async () => {
    renderApp('/hy/page-a#anchor');

    await waitFor(() => {
      expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
    });
    expect(window.scrollTo).not.toHaveBeenCalled();
  });
});
