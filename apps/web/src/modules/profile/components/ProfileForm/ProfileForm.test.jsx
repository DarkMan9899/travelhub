import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProfileForm from './ProfileForm.jsx';

const BASE_USER = {
  first_name: 'Ana',
  last_name: 'Smith',
  phone: '+37411000000',
  preferred_language_id: 2,
  preferred_currency_id: 1,
  is_email_verified: true,
};

describe('ProfileForm (apps/web/src/modules/profile)', () => {
  test('renders prefilled from the user prop', () => {
    render(<ProfileForm user={BASE_USER} onSave={vi.fn()} />);
    expect(screen.getByLabelText(/Անուն/)).toHaveValue('Ana');
    expect(screen.getByLabelText(/Ազգանուն/)).toHaveValue('Smith');
    expect(screen.getByLabelText(/Հեռախոս/)).toHaveValue('+37411000000');
  });

  test('the save button is disabled until a field changes', async () => {
    const user = userEvent.setup();
    render(<ProfileForm user={BASE_USER} onSave={vi.fn()} />);

    expect(
      screen.getByRole('button', { name: 'Պահպանել փոփոխությունները' }),
    ).toBeDisabled();

    await user.type(screen.getByLabelText(/Անուն/), 'x');

    expect(
      screen.getByRole('button', { name: 'Պահպանել փոփոխությունները' }),
    ).toBeEnabled();
  });

  test('submitting calls onSave with the edited fields', async () => {
    const onSave = vi.fn();
    const user = userEvent.setup();
    render(<ProfileForm user={BASE_USER} onSave={onSave} />);

    const firstNameInput = screen.getByLabelText(/Անուն/);
    await user.clear(firstNameInput);
    await user.type(firstNameInput, 'Anush');
    await user.click(
      screen.getByRole('button', { name: 'Պահպանել փոփոխությունները' }),
    );

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        firstName: 'Anush',
        lastName: 'Smith',
        phone: '+37411000000',
      }),
    );
  });

  test('shows an unverified-email warning when the user has not verified their email', () => {
    render(
      <ProfileForm
        user={{ ...BASE_USER, is_email_verified: false }}
        onSave={vi.fn()}
      />,
    );
    expect(
      screen.getByText('Ձեր էլ. փոստի հասցեն դեռ հաստատված չէ։'),
    ).toBeInTheDocument();
  });
});
