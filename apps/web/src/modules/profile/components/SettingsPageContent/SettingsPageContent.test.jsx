import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ToastProvider from '../../../../providers/ToastProvider.jsx';
import SettingsPageContent from './SettingsPageContent.jsx';
import { useAuth } from '../../../../contexts/AuthContext.jsx';
import { useChangePasswordMutation } from '../../mutations/useChangePasswordMutation.js';

vi.mock('../../../../contexts/AuthContext.jsx', () => ({ useAuth: vi.fn() }));
vi.mock('../../mutations/useChangePasswordMutation.js', () => ({
  useChangePasswordMutation: vi.fn(),
  default: vi.fn(),
}));

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/en/account/settings']}>
        <ToastProvider>
          <Routes>
            <Route
              path="/:locale/account/settings"
              element={<SettingsPageContent />}
            />
          </Routes>
        </ToastProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('SettingsPageContent (apps/web/src/modules/profile)', () => {
  beforeEach(() => {
    useAuth.mockReturnValue({ user: { id: 1 } });
  });

  test('renders the password form and the danger zone', () => {
    useChangePasswordMutation.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
      error: null,
    });
    renderPage();

    expect(screen.getByLabelText(/Ընթացիկ գաղտնաբառ/)).toBeInTheDocument();
    expect(screen.getByText('Վտանգավոր գոտի')).toBeInTheDocument();
  });

  test('a successful password change shows a success toast', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({});
    useChangePasswordMutation.mockReturnValue({
      mutateAsync,
      isPending: false,
      error: null,
    });
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText(/Ընթացիկ գաղտնաբառ/), 'OldPass!2024');
    await user.type(
      screen.getByLabelText(/Նոր գաղտնաբառ/),
      'NewStrongPass!2024',
    );
    await user.type(
      screen.getByLabelText(/Հաստատեք նոր գաղտնաբառը/),
      'NewStrongPass!2024',
    );
    await user.click(screen.getByRole('button', { name: 'Փոխել գաղտնաբառը' }));

    expect(
      await screen.findByText('Ձեր գաղտնաբառը փոխվել է։'),
    ).toBeInTheDocument();
  });
});
