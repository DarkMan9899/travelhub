import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ToastProvider from '../../../../providers/ToastProvider.jsx';
import ProfilePageContent from './ProfilePageContent.jsx';
import { useAuth } from '../../../../contexts/AuthContext.jsx';
import { useUpdateProfileMutation } from '../../mutations/useUpdateProfileMutation.js';
import { useUploadAvatarMutation } from '../../mutations/useUploadAvatarMutation.js';

vi.mock('../../../../contexts/AuthContext.jsx', () => ({ useAuth: vi.fn() }));
vi.mock('../../mutations/useUpdateProfileMutation.js', () => ({
  useUpdateProfileMutation: vi.fn(),
  default: vi.fn(),
}));
vi.mock('../../mutations/useUploadAvatarMutation.js', () => ({
  useUploadAvatarMutation: vi.fn(),
  default: vi.fn(),
}));

const BASE_USER = {
  id: 1,
  first_name: 'Ana',
  last_name: 'Smith',
  phone: '+37411000000',
  avatar_url: null,
  preferred_language_id: 2,
  preferred_currency_id: 1,
  is_email_verified: true,
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/en/account/profile']}>
      <ToastProvider>
        <Routes>
          <Route
            path="/:locale/account/profile"
            element={<ProfilePageContent />}
          />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
  );
}

describe('ProfilePageContent (apps/web/src/modules/profile)', () => {
  beforeEach(() => {
    useAuth.mockReturnValue({ user: BASE_USER });
  });

  test('saving the profile form shows a success toast', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({});
    useUpdateProfileMutation.mockReturnValue({ mutateAsync, isPending: false });
    useUploadAvatarMutation.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    });
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText(/Անուն/), 'x');
    await user.click(
      screen.getByRole('button', { name: 'Պահպանել փոփոխությունները' }),
    );

    expect(
      await screen.findByText('Ձեր անձնական տվյալները թարմացվել են։'),
    ).toBeInTheDocument();
    expect(mutateAsync).toHaveBeenCalledTimes(1);
  });

  test('a failed save shows an error toast', async () => {
    const mutateAsync = vi.fn().mockRejectedValue(new Error('network'));
    useUpdateProfileMutation.mockReturnValue({ mutateAsync, isPending: false });
    useUploadAvatarMutation.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    });
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText(/Անուն/), 'x');
    await user.click(
      screen.getByRole('button', { name: 'Պահպանել փոփոխությունները' }),
    );

    expect(
      await screen.findByText(
        'Չհաջողվեց պահպանել փոփոխությունները։ Խնդրում ենք կրկին փորձել։',
      ),
    ).toBeInTheDocument();
  });

  test('uploading an avatar shows a success toast', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({});
    useUploadAvatarMutation.mockReturnValue({ mutateAsync, isPending: false });
    useUpdateProfileMutation.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    });
    const user = userEvent.setup();
    renderPage();

    const input = document.querySelector('input[type="file"]');
    const file = new File(['x'], 'avatar.png', { type: 'image/png' });
    await user.upload(input, file);

    expect(
      await screen.findByText('Ձեր պրոֆիլի նկարը թարմացվել է։'),
    ).toBeInTheDocument();
    expect(mutateAsync).toHaveBeenCalledWith(file);
  });
});
