import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ResetPasswordForm from './ResetPasswordForm.jsx';
import { useResetPasswordMutation } from '../../mutations/useResetPasswordMutation.js';

vi.mock('../../mutations/useResetPasswordMutation.js', () => ({
  useResetPasswordMutation: vi.fn(),
  default: vi.fn(),
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

function renderForm(token = 'abc123') {
  return render(
    <MemoryRouter initialEntries={[`/hy/auth/reset-password/${token}`]}>
      <Routes>
        <Route
          path="/:locale/auth/reset-password/:token"
          element={<ResetPasswordForm />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ResetPasswordForm (apps/web/src/modules/auth)', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    useResetPasswordMutation.mockReset();
  });

  test('a mismatched confirmation blocks submission', async () => {
    const mutateAsync = vi.fn();
    useResetPasswordMutation.mockReturnValue({
      mutateAsync,
      isPending: false,
      error: null,
    });
    const user = userEvent.setup();
    renderForm();

    await user.type(
      screen.getByLabelText(/Նոր գաղտնաբառ/),
      'NewStrongPass!2024',
    );
    await user.type(
      screen.getByLabelText(/Հաստատեք նոր գաղտնաբառը/),
      'Different!2024',
    );
    await user.click(
      screen.getByRole('button', { name: 'Վերականգնել գաղտնաբառը' }),
    );

    expect(
      screen.getByText('Գաղտնաբառերը չեն համընկնում։'),
    ).toBeInTheDocument();
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  test('a matching, strong password submits with the token from the route (never a form field) and redirects to login', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({ reset: true });
    useResetPasswordMutation.mockReturnValue({
      mutateAsync,
      isPending: false,
      error: null,
    });
    const user = userEvent.setup();
    renderForm('the-real-token-value');

    await user.type(
      screen.getByLabelText(/Նոր գաղտնաբառ/),
      'NewStrongPass!2024',
    );
    await user.type(
      screen.getByLabelText(/Հաստատեք նոր գաղտնաբառը/),
      'NewStrongPass!2024',
    );
    await user.click(
      screen.getByRole('button', { name: 'Վերականգնել գաղտնաբառը' }),
    );

    expect(mutateAsync).toHaveBeenCalledWith({
      token: 'the-real-token-value',
      newPassword: 'NewStrongPass!2024',
    });
    expect(mockNavigate).toHaveBeenCalledWith('/hy/auth/login?reset=success', {
      replace: true,
    });
  });

  test('RESET_TOKEN_EXPIRED replaces the form with an expired message and a link to request a new one, not a resubmittable form', () => {
    useResetPasswordMutation.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
      error: { code: 'RESET_TOKEN_EXPIRED' },
    });
    renderForm();

    expect(
      screen.getByText('Այս հղումն այլևս ուժի մեջ չէ։ Հայցեք նոր հղում։'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Հայցել նոր հղում' }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText(/Նոր գաղտնաբառ/)).not.toBeInTheDocument();
  });

  test('RESET_TOKEN_INVALID shows the invalid-link message', () => {
    useResetPasswordMutation.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
      error: { code: 'RESET_TOKEN_INVALID' },
    });
    renderForm();

    expect(
      screen.getByText('Այս հղումն անվավեր է կամ արդեն օգտագործվել է։'),
    ).toBeInTheDocument();
  });
});
