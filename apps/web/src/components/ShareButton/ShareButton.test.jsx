import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ToastProvider from '../../providers/ToastProvider.jsx';
import ShareButton from './ShareButton.jsx';

function renderButton() {
  return render(
    <ToastProvider>
      <ShareButton title="Cozy Villa" />
    </ToastProvider>,
  );
}

describe('ShareButton (Phase 18)', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'share', {
      value: undefined,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(navigator, 'clipboard', {
      value: undefined,
      configurable: true,
      writable: true,
    });
  });

  test('uses the native Web Share API when available', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    navigator.share = share;
    const user = userEvent.setup();
    renderButton();

    await user.click(screen.getByRole('button'));

    await waitFor(() =>
      expect(share).toHaveBeenCalledWith({
        title: 'Cozy Villa',
        url: window.location.href,
      }),
    );
  });

  test('falls back to copying the URL and shows a success toast when Web Share is unsupported', async () => {
    // `userEvent.setup()` installs its own `navigator.clipboard` stub (for
    // its own copy/paste helpers) — the mock must be assigned AFTER setup
    // or setup's stub silently clobbers it.
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
      writable: true,
    });
    renderButton();

    await user.click(screen.getByRole('button'));

    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(window.location.href),
    );
    expect(await screen.findByText('Հղումը պատճենվել է')).toBeInTheDocument();
  });

  test('shows an error toast when the clipboard write itself fails', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
      writable: true,
    });
    renderButton();

    await user.click(screen.getByRole('button'));

    expect(
      await screen.findByText('Չհաջողվեց պատճենել հղումը'),
    ).toBeInTheDocument();
  });
});
