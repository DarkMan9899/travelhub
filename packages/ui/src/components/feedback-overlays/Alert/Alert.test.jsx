import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Alert from './Alert.jsx';

describe('Alert (persistent inline banner)', () => {
  test('renders title and message content', () => {
    render(
      <Alert variant="success" title="Booking confirmed">
        Your reservation is confirmed for July 20.
      </Alert>,
    );
    expect(screen.getByText('Booking confirmed')).toBeInTheDocument();
    expect(
      screen.getByText('Your reservation is confirmed for July 20.'),
    ).toBeInTheDocument();
  });

  test('uses role="alert" (assertive) for the danger variant', () => {
    render(<Alert variant="danger">Payment failed.</Alert>);
    expect(screen.getByRole('alert')).toHaveTextContent('Payment failed.');
  });

  test('uses role="status" (polite) for non-danger variants', () => {
    ['success', 'warning', 'info'].forEach((variant) => {
      const { unmount } = render(<Alert variant={variant}>Message</Alert>);
      expect(screen.getByRole('status')).toBeInTheDocument();
      unmount();
    });
  });

  test('renders a dismiss button that fires onDismiss when dismissible', async () => {
    const onDismiss = vi.fn();
    const user = userEvent.setup();
    render(
      <Alert variant="info" dismissible onDismiss={onDismiss}>
        You have a new message.
      </Alert>,
    );

    await user.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  test('renders no dismiss button when not dismissible', () => {
    render(<Alert variant="info">Notice</Alert>);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
