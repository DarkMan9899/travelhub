import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Label from './Label.jsx';

describe('Label', () => {
  test('associates with its control via htmlFor/id, focusing it on click', async () => {
    const user = userEvent.setup();
    render(
      <>
        <Label htmlFor="email">Email</Label>
        <input id="email" type="text" />
      </>,
    );

    await user.click(screen.getByText('Email'));
    expect(screen.getByRole('textbox')).toHaveFocus();
  });

  test('renders a required indicator that does not change the accessible name', () => {
    render(
      <Label htmlFor="name" required>
        Full name
      </Label>,
    );
    expect(screen.getByText('Full name')).toBeInTheDocument();
  });
});
