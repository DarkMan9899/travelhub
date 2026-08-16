import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AuthProvider from './AuthProvider.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import * as authApi from '../api/auth.js';
import * as partnersApi from '../api/partners.js';
import { getAccessToken } from '../api/tokenStore.js';

vi.mock('../api/auth.js');
vi.mock('../api/partners.js');

function Consumer() {
  const {
    isAuthenticated,
    isBootstrapping,
    user,
    partnerships,
    login,
    logout,
    refreshUser,
  } = useAuth();
  if (isBootstrapping) return <p>booting</p>;
  return (
    <div>
      <p>{isAuthenticated ? `in:${user.email}` : 'out'}</p>
      <p data-testid="partnerships">
        {partnerships.map((membership) => membership.slug).join(',')}
      </p>
      <button
        type="button"
        onClick={() => login({ email: 'a@b.com', password: 'x' })}
      >
        login
      </button>
      <button type="button" onClick={() => logout()}>
        logout
      </button>
      <button type="button" onClick={() => refreshUser()}>
        refresh
      </button>
    </div>
  );
}

describe('AuthProvider (apps/web/src/providers)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    partnersApi.getMyPartnerships.mockResolvedValue({ data: [] });
  });

  test('bootstraps to logged-out when no refresh session exists', async () => {
    authApi.refresh.mockRejectedValue(new Error('no session'));

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );

    expect(screen.getByText('booting')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('out')).toBeInTheDocument());
    expect(getAccessToken()).toBeNull();
  });

  test('bootstraps to logged-in via refresh + me when a session exists, also hydrating partnerships', async () => {
    authApi.refresh.mockResolvedValue({ data: { access_token: 'token-1' } });
    authApi.me.mockResolvedValue({
      data: {
        user: { id: 1, email: 'existing@session.com' },
        roles: ['CUSTOMER'],
        permissions: [],
      },
    });
    partnersApi.getMyPartnerships.mockResolvedValue({
      data: [
        { partner_id: 1, slug: 'yerevan-boutique-hospitality', role: 'OWNER' },
      ],
    });

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );

    await waitFor(() =>
      expect(screen.getByText('in:existing@session.com')).toBeInTheDocument(),
    );
    expect(getAccessToken()).toBe('token-1');
    expect(screen.getByTestId('partnerships')).toHaveTextContent(
      'yerevan-boutique-hospitality',
    );
  });

  test('login() calls POST /auth/login then GET /auth/me and hydrates the session', async () => {
    const user = userEvent.setup();
    authApi.refresh.mockRejectedValue(new Error('no session'));
    authApi.login.mockResolvedValue({
      data: { access_token: 'token-2', user: { id: 2 } },
    });
    authApi.me.mockResolvedValue({
      data: {
        user: { id: 2, email: 'a@b.com' },
        roles: [],
        permissions: [],
      },
    });

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByText('out')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'login' }));

    await waitFor(() =>
      expect(screen.getByText('in:a@b.com')).toBeInTheDocument(),
    );
    expect(authApi.login).toHaveBeenCalledWith({
      email: 'a@b.com',
      password: 'x',
    });
    expect(getAccessToken()).toBe('token-2');
  });

  test('logout() clears the session even if the API call fails', async () => {
    const user = userEvent.setup();
    authApi.refresh.mockResolvedValue({ data: { access_token: 'token-3' } });
    authApi.me.mockResolvedValue({
      data: { user: { id: 3, email: 'c@d.com' }, roles: [], permissions: [] },
    });
    authApi.logout.mockRejectedValue(new Error('network error'));

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );
    await waitFor(() =>
      expect(screen.getByText('in:c@d.com')).toBeInTheDocument(),
    );

    await user.click(screen.getByRole('button', { name: 'logout' }));

    await waitFor(() => expect(screen.getByText('out')).toBeInTheDocument());
    expect(getAccessToken()).toBeNull();
  });

  test('refreshUser() re-fetches /auth/me and updates the session (Phase 8)', async () => {
    const user = userEvent.setup();
    authApi.refresh.mockResolvedValue({ data: { access_token: 'token-4' } });
    authApi.me
      .mockResolvedValueOnce({
        data: {
          user: { id: 4, email: 'stale@example.com' },
          roles: [],
          permissions: [],
        },
      })
      .mockResolvedValueOnce({
        data: {
          user: { id: 4, email: 'fresh@example.com' },
          roles: [],
          permissions: [],
        },
      });

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );
    await waitFor(() =>
      expect(screen.getByText('in:stale@example.com')).toBeInTheDocument(),
    );

    await user.click(screen.getByRole('button', { name: 'refresh' }));

    await waitFor(() =>
      expect(screen.getByText('in:fresh@example.com')).toBeInTheDocument(),
    );
    expect(authApi.me).toHaveBeenCalledTimes(2);
  });
});
