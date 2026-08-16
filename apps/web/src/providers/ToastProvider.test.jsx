import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ToastProvider from './ToastProvider.jsx';
import { useToast } from '../contexts/ToastContext.jsx';

function Trigger() {
  const { showToast } = useToast();
  return (
    <button
      type="button"
      onClick={() =>
        showToast('Booking request sent', { variant: 'success', duration: 0 })
      }
    >
      Notify
    </button>
  );
}

describe('ToastProvider (apps/web/src/providers)', () => {
  test('shows a toast on demand and dismisses it on close', async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );

    expect(screen.queryByText('Booking request sent')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Notify' }));
    expect(screen.getByText('Booking request sent')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByText('Booking request sent')).not.toBeInTheDocument();
  });
});
