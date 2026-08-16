import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ToastProvider from '../../../../providers/ToastProvider.jsx';
import ConfirmProvider from '../../../../providers/ConfirmProvider.jsx';
import AdminUsersPageContent from './AdminUsersPageContent.jsx';
import { useAdminUsersQuery } from '../../queries/useAdminUsersQuery.js';
import { useUpdateUserStatusMutation } from '../../mutations/useUpdateUserStatusMutation.js';
import { useAuth } from '../../../../contexts/AuthContext.jsx';

vi.mock('../../queries/useAdminUsersQuery.js', () => ({
  useAdminUsersQuery: vi.fn(),
}));
vi.mock('../../mutations/useUpdateUserStatusMutation.js', () => ({
  useUpdateUserStatusMutation: vi.fn(),
}));
vi.mock('../../../../contexts/AuthContext.jsx', () => ({ useAuth: vi.fn() }));

function userFixture(overrides) {
  return {
    id: 1,
    email: 'anna@example.com',
    first_name: 'Anna',
    last_name: 'Harutyunyan',
    status_code: 'ACTIVE',
    role_codes: ['CUSTOMER'],
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/hy/admin/users']}>
      <ToastProvider>
        <ConfirmProvider>
          <Routes>
            <Route
              path="/:locale/admin/users"
              element={<AdminUsersPageContent />}
            />
          </Routes>
        </ConfirmProvider>
      </ToastProvider>
    </MemoryRouter>,
  );
}

const noopQueryExtras = {
  refetch: vi.fn(),
  fetchNextPage: vi.fn(),
  hasNextPage: false,
  isFetchingNextPage: false,
};

describe('AdminUsersPageContent (apps/web/src/modules/admin)', () => {
  let mutateAsync;

  beforeEach(() => {
    mutateAsync = vi.fn().mockResolvedValue({});
    useUpdateUserStatusMutation.mockReturnValue({
      mutateAsync,
      isPending: false,
      variables: undefined,
    });
    useAuth.mockReturnValue({ permissions: ['user.suspend'] });
  });

  test('shows a retryable error state', async () => {
    const refetch = vi.fn();
    useAdminUsersQuery.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
      ...noopQueryExtras,
      refetch,
    });
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Կրկին փորձել' }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  test('renders real user rows with email/status/roles', () => {
    useAdminUsersQuery.mockReturnValue({
      data: { pages: [{ results: [userFixture()] }] },
      isPending: false,
      isError: false,
      ...noopQueryExtras,
    });
    renderPage();

    expect(screen.getByText('anna@example.com')).toBeInTheDocument();
    expect(screen.getByText('Ակտիվ')).toBeInTheDocument();
    expect(screen.getByText('CUSTOMER')).toBeInTheDocument();
  });

  test('suspending a user asks for confirmation, then calls the mutation on confirm', async () => {
    useAdminUsersQuery.mockReturnValue({
      data: { pages: [{ results: [userFixture()] }] },
      isPending: false,
      isError: false,
      ...noopQueryExtras,
    });
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Կասեցնել' }));
    expect(
      screen.getByText('Կասեցնե՞լ Anna Harutyunyan-ին։'),
    ).toBeInTheDocument();

    // Two "Կասեցնել" buttons now exist: the row's trigger and the
    // confirmation modal's own confirm button — the modal's is the
    // second one rendered.
    const suspendButtons = screen.getAllByRole('button', { name: 'Կասեցնել' });
    await user.click(suspendButtons[suspendButtons.length - 1]);
    expect(mutateAsync).toHaveBeenCalledWith({ id: 1, status: 'SUSPENDED' });
  });
});
