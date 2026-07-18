import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EmptyState from './EmptyState.jsx';

describe('EmptyState (COMPONENT_LIBRARY.md Part II §4)', () => {
  test('renders title and description', () => {
    render(
      <EmptyState
        title="No bookings yet"
        description="Your trips will show up here."
      />,
    );
    expect(screen.getByText('No bookings yet')).toBeInTheDocument();
    expect(
      screen.getByText('Your trips will show up here.'),
    ).toBeInTheDocument();
  });

  test('renders the action as a real, keyboard-reachable Button that fires onAction', async () => {
    const onAction = vi.fn();
    const user = userEvent.setup();
    render(
      <EmptyState
        title="No favorites yet"
        actionLabel="Browse listings"
        onAction={onAction}
      />,
    );

    const button = screen.getByRole('button', { name: 'Browse listings' });
    await user.click(button);

    expect(onAction).toHaveBeenCalledTimes(1);
  });

  test('renders no action when actionLabel/onAction are omitted', () => {
    render(<EmptyState title="No results" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  test('illustration is decorative (aria-hidden), never announced', () => {
    const { container } = render(
      <EmptyState
        title="No notifications"
        illustration={<svg data-testid="illustration" />}
      />,
    );
    expect(container.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
  });
});
