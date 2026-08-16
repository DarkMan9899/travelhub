import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import RequireAuth from './RequireAuth.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';

vi.mock('../contexts/AuthContext.jsx', () => ({
  useAuth: vi.fn(),
}));

function renderProtected() {
  return render(
    <MemoryRouter initialEntries={['/hy/account']}>
      <Routes>
        <Route
          path="/:locale/account"
          element={
            <RequireAuth>
              <div>Protected content</div>
            </RequireAuth>
          }
        />
        <Route path="/:locale/auth/login" element={<div>Login page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('RequireAuth (apps/web/src/guards)', () => {
  test('renders a loader while the session is still bootstrapping', () => {
    useAuth.mockReturnValue({ isAuthenticated: false, isBootstrapping: true });
    renderProtected();
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
    expect(screen.queryByText('Login page')).not.toBeInTheDocument();
  });

  test('redirects to login when not authenticated', () => {
    useAuth.mockReturnValue({ isAuthenticated: false, isBootstrapping: false });
    renderProtected();
    expect(screen.getByText('Login page')).toBeInTheDocument();
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
  });

  test('renders children once authenticated', () => {
    useAuth.mockReturnValue({ isAuthenticated: true, isBootstrapping: false });
    renderProtected();
    expect(screen.getByText('Protected content')).toBeInTheDocument();
  });
});
