import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import CustomerAccountLayout from './CustomerAccountLayout.jsx';

vi.mock('../contexts/AuthContext.jsx', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    isBootstrapping: false,
    user: { id: 1, first_name: 'Ana', last_name: 'Smith' },
    logout: vi.fn(),
  }),
}));

function renderAt(path) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/:locale/account" element={<CustomerAccountLayout />}>
            <Route index element={<p>overview</p>} />
            <Route path="bookings" element={<p>bookings list</p>} />
            <Route path="bookings/:id" element={<p>booking detail</p>} />
            <Route path="profile" element={<p>profile</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('CustomerAccountLayout (apps/web/src/layouts)', () => {
  test('highlights "Ամրագրումներ" (Bookings) on the exact list route', () => {
    renderAt('/hy/account/bookings');
    expect(
      screen.getByRole('link', { name: 'Ամրագրումներ', current: 'page' }),
    ).toBeInTheDocument();
  });

  test('still highlights "Ամրագրումներ" on a nested booking-detail route (Phase 8 fix)', () => {
    renderAt('/hy/account/bookings/7');
    expect(
      screen.getByRole('link', { name: 'Ամրագրումներ', current: 'page' }),
    ).toBeInTheDocument();
  });

  test('highlights "Ընդհանուր տեսք" (Overview) on the account root, not Bookings', () => {
    renderAt('/hy/account');
    expect(
      screen.getByRole('link', { name: 'Ընդհանուր տեսք', current: 'page' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Ամրագրումներ', current: 'page' }),
    ).not.toBeInTheDocument();
  });
});
