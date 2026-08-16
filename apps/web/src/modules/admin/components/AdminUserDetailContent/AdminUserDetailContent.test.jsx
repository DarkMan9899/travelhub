import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ToastProvider from '../../../../providers/ToastProvider.jsx';
import ConfirmProvider from '../../../../providers/ConfirmProvider.jsx';
import AdminUserDetailContent from './AdminUserDetailContent.jsx';
import { useAdminUserDetailQuery } from '../../queries/useAdminUserDetailQuery.js';
import { useAdminUserBookingsQuery } from '../../queries/useAdminUserBookingsQuery.js';
import { useAdminUserPartnershipsQuery } from '../../queries/useAdminUserPartnershipsQuery.js';
import { useUpdateUserStatusMutation } from '../../mutations/useUpdateUserStatusMutation.js';
import { useAuth } from '../../../../contexts/AuthContext.jsx';

vi.mock('../../queries/useAdminUserDetailQuery.js', () => ({
  useAdminUserDetailQuery: vi.fn(),
}));
vi.mock('../../queries/useAdminUserBookingsQuery.js', () => ({
  useAdminUserBookingsQuery: vi.fn(),
}));
vi.mock('../../queries/useAdminUserPartnershipsQuery.js', () => ({
  useAdminUserPartnershipsQuery: vi.fn(),
}));
vi.mock('../../mutations/useUpdateUserStatusMutation.js', () => ({
  useUpdateUserStatusMutation: vi.fn(),
}));
vi.mock('../../../../contexts/AuthContext.jsx', () => ({ useAuth: vi.fn() }));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/hy/admin/users/1']}>
      <ToastProvider>
        <ConfirmProvider>
          <Routes>
            <Route
              path="/:locale/admin/users/:id"
              element={<AdminUserDetailContent />}
            />
          </Routes>
        </ConfirmProvider>
      </ToastProvider>
    </MemoryRouter>,
  );
}

describe('AdminUserDetailContent (apps/web/src/modules/admin)', () => {
  beforeEach(() => {
    useAuth.mockReturnValue({ permissions: ['user.suspend'] });
  });

  test('shows a retryable error state', () => {
    const refetch = vi.fn();
    useAdminUserDetailQuery.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
      refetch,
    });
    useAdminUserBookingsQuery.mockReturnValue({
      data: undefined,
      isPending: true,
    });
    useAdminUserPartnershipsQuery.mockReturnValue({
      data: undefined,
      isPending: true,
    });
    useUpdateUserStatusMutation.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    });
    renderPage();

    expect(
      screen.getByText('Չհաջողվեց բեռնել այս օգտատիրոջը։'),
    ).toBeInTheDocument();
  });

  test('renders profile, real booking history, and real partnerships', () => {
    useAdminUserDetailQuery.mockReturnValue({
      data: {
        id: 1,
        email: 'vendor@travelhub.dev',
        first_name: 'Dev',
        last_name: 'Vendor',
        status_code: 'ACTIVE',
        role_codes: ['CUSTOMER'],
      },
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    });
    useAdminUserBookingsQuery.mockReturnValue({
      data: [
        {
          id: 1,
          booking_reference: 'BK-1',
          status: 'CONFIRMED',
          total_amount: '1000.00',
        },
      ],
      isPending: false,
    });
    useAdminUserPartnershipsQuery.mockReturnValue({
      data: [
        {
          partner_id: 1,
          display_name: 'Yerevan Boutique Hospitality',
          role: 'OWNER',
        },
      ],
      isPending: false,
    });
    useUpdateUserStatusMutation.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    });
    renderPage();

    expect(screen.getByText('vendor@travelhub.dev')).toBeInTheDocument();
    expect(screen.getByText('BK-1')).toBeInTheDocument();
    expect(
      screen.getByText('Yerevan Boutique Hospitality'),
    ).toBeInTheDocument();
    expect(screen.getByText('OWNER')).toBeInTheDocument();
  });

  test('shows empty states when there is no booking history or partnerships', () => {
    useAdminUserDetailQuery.mockReturnValue({
      data: {
        id: 3,
        email: 'customer@travelhub.dev',
        first_name: 'Dev',
        last_name: 'Customer',
        status_code: 'ACTIVE',
        role_codes: ['CUSTOMER'],
      },
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    });
    useAdminUserBookingsQuery.mockReturnValue({ data: [], isPending: false });
    useAdminUserPartnershipsQuery.mockReturnValue({
      data: [],
      isPending: false,
    });
    useUpdateUserStatusMutation.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    });
    renderPage();

    expect(screen.getByText('Ամրագրումներ դեռ չկան։')).toBeInTheDocument();
    expect(
      screen.getByText('Չի հանդիսանում որևէ գործընկեր կազմակերպության անդամ։'),
    ).toBeInTheDocument();
  });
});
