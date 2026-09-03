import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ForgotPasswordForm from './ForgotPasswordForm.jsx';
import { useRequestPasswordResetMutation } from '../../mutations/useRequestPasswordResetMutation.js';

vi.mock('../../mutations/useRequestPasswordResetMutation.js', () => ({
  useRequestPasswordResetMutation: vi.fn(),
  default: vi.fn(),
}));

function renderForm() {
  return render(
    <MemoryRouter initialEntries={['/hy/auth/forgot-password']}>
      <Routes>
        <Route
          path="/:locale/auth/forgot-password"
          element={<ForgotPasswordForm />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ForgotPasswordForm (apps/web/src/modules/auth)', () => {
  beforeEach(() => {
    useRequestPasswordResetMutation.mockReset();
  });

  test('submitting a valid email calls the mutation and shows the same generic success message every time', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({ requested: true });
    useRequestPasswordResetMutation.mockReturnValue({
      mutateAsync,
      isPending: false,
      error: null,
    });
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText(/Էլ\. փոստ/), 'someone@example.com');
    await user.click(screen.getByRole('button', { name: 'Ուղարկել հղումը' }));

    expect(mutateAsync).toHaveBeenCalledWith({
      email: 'someone@example.com',
      locale: 'hy',
    });
    expect(
      await screen.findByText(
        'Եթե այդ էլ. հասցեով հաշիվ գոյություն ունի, մենք ուղարկել ենք գաղտնաբառի վերականգնման հղում։ Ստուգեք ձեր էլ. փոստը։',
      ),
    ).toBeInTheDocument();
  });

  test('a genuine request failure shows a generic error, never an account-existence signal', async () => {
    const mutateAsync = vi.fn().mockRejectedValue(new Error('network down'));
    useRequestPasswordResetMutation.mockReturnValue({
      mutateAsync,
      isPending: false,
      error: new Error('network down'),
    });
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText(/Էլ\. փոստ/), 'someone@example.com');
    await user.click(screen.getByRole('button', { name: 'Ուղարկել հղումը' }));

    expect(
      await screen.findByText(
        'Ինչ-որ բան սխալ գնաց։ Խնդրում ենք կրկին փորձել։',
      ),
    ).toBeInTheDocument();
  });
});
