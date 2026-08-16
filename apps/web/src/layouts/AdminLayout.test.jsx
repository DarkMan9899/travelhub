import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AdminLayout from './AdminLayout.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';

vi.mock('../contexts/AuthContext.jsx', () => ({ useAuth: vi.fn() }));

const FULL_ADMIN_PERMISSIONS = [
  'user.list',
  'listing.moderate',
  'booking.view_all',
  'audit.view',
];

function renderAt(path) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/:locale/admin" element={<AdminLayout />}>
            <Route index element={<p>dashboard content</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('AdminLayout (apps/web/src/layouts)', () => {
  test('highlights "Վահանակ" (Dashboard) on the admin root and renders the outlet', () => {
    useAuth.mockReturnValue({
      isAuthenticated: true,
      isBootstrapping: false,
      user: { id: 1, first_name: 'Dev', last_name: 'Admin' },
      permissions: FULL_ADMIN_PERMISSIONS,
      logout: vi.fn(),
    });
    renderAt('/hy/admin');
    expect(
      screen.getByRole('link', { name: 'Վահանակ', current: 'page' }),
    ).toBeInTheDocument();
    expect(screen.getByText('dashboard content')).toBeInTheDocument();
  });

  // Phase 14.10 cleanup: MODERATOR lacks `user.list`/`booking.view_all`/
  // `audit.view` — those three nav entries must not dead-end into a 403.
  test('hides Users/Bookings/Audit-Logs nav entries for a role missing their read permission', () => {
    useAuth.mockReturnValue({
      isAuthenticated: true,
      isBootstrapping: false,
      user: { id: 1, first_name: 'Dev', last_name: 'Moderator' },
      permissions: ['listing.moderate'],
      logout: vi.fn(),
    });
    renderAt('/hy/admin');
    expect(
      screen.queryByRole('link', { name: 'Օգտատերեր' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Ամրագրումներ' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Աուդիտի մատյան' }),
    ).not.toBeInTheDocument();
    // Listings requires listing.moderate, which this role has.
    expect(
      screen.getByRole('link', { name: 'Հայտարարություններ' }),
    ).toBeInTheDocument();
  });
});
