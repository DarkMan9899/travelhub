import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Newsletter from './Newsletter.jsx';

describe('Newsletter (apps/web/src/modules/home)', () => {
  test('renders an email field and submit control', () => {
    render(<Newsletter />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  test('shows a validation error and does not show success for an invalid email', async () => {
    const user = userEvent.setup();
    render(<Newsletter />);

    await user.type(screen.getByRole('textbox'), 'not-an-email');
    await user.click(screen.getByRole('button'));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  test('shows a success state and clears the form for a valid email', async () => {
    const user = userEvent.setup();
    render(<Newsletter />);

    await user.type(screen.getByRole('textbox'), 'traveler@example.com');
    await user.click(screen.getByRole('button'));

    expect(await screen.findByRole('status')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  test('shows a validation error when the email is left empty', async () => {
    const user = userEvent.setup();
    render(<Newsletter />);

    await user.click(screen.getByRole('button'));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });
});
