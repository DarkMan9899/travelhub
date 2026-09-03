import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ToastProvider from '../../../../providers/ToastProvider.jsx';
import ConfirmProvider from '../../../../providers/ConfirmProvider.jsx';
import PartnerStaffPageContent from './PartnerStaffPageContent.jsx';
import { usePartnerContext } from '../../../../contexts/PartnerContext.jsx';
import { useStaffQuery } from '../../queries/useStaffQuery.js';
import { useStaffInvitationsQuery } from '../../queries/useStaffInvitationsQuery.js';
import { useInviteStaffMutation } from '../../mutations/useInviteStaffMutation.js';
import { useRevokeInvitationMutation } from '../../mutations/useRevokeInvitationMutation.js';
import { useUpdateStaffRoleMutation } from '../../mutations/useUpdateStaffRoleMutation.js';
import { useRemoveStaffMutation } from '../../mutations/useRemoveStaffMutation.js';

vi.mock('../../../../contexts/PartnerContext.jsx', () => ({
  usePartnerContext: vi.fn(),
}));
vi.mock('../../queries/useStaffQuery.js', () => ({ useStaffQuery: vi.fn() }));
vi.mock('../../queries/useStaffInvitationsQuery.js', () => ({
  useStaffInvitationsQuery: vi.fn(),
}));
vi.mock('../../mutations/useInviteStaffMutation.js', () => ({
  useInviteStaffMutation: vi.fn(),
}));
vi.mock('../../mutations/useRevokeInvitationMutation.js', () => ({
  useRevokeInvitationMutation: vi.fn(),
}));
vi.mock('../../mutations/useUpdateStaffRoleMutation.js', () => ({
  useUpdateStaffRoleMutation: vi.fn(),
}));
vi.mock('../../mutations/useRemoveStaffMutation.js', () => ({
  useRemoveStaffMutation: vi.fn(),
}));

const STAFF = [
  {
    id: 1,
    user_id: 10,
    email: 'owner@example.com',
    first_name: 'Ann',
    last_name: 'Owner',
    role: 'OWNER',
    role_name: 'Owner',
    since: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 2,
    user_id: 20,
    email: 'editor@example.com',
    first_name: 'Ed',
    last_name: 'Itor',
    role: 'EDITOR',
    role_name: 'Editor',
    since: '2026-02-01T00:00:00.000Z',
  },
];

const INVITATIONS = [
  {
    id: 5,
    email: 'pending@example.com',
    role: 'MANAGER',
    role_name: 'Manager',
    expires_at: '2026-12-01T00:00:00.000Z',
    created_at: '2026-06-01T00:00:00.000Z',
  },
];

// This app's default/fallback i18next language is Armenian ('hy') — a
// bare component test never runs the URL-driven `changeLanguage` effect
// (that's wired at the route-tree/LanguageSwitcher level), so `hy` is
// what actually renders regardless of the route param, same convention
// every other page-content test in this codebase already follows (e.g.
// `AdminUsersPageContent.test.jsx`, `PartnerProfilePageContent.test.jsx`).
function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/hy/partner/staff']}>
      <ToastProvider>
        <ConfirmProvider>
          <Routes>
            <Route
              path="/:locale/partner/staff"
              element={<PartnerStaffPageContent />}
            />
          </Routes>
        </ConfirmProvider>
      </ToastProvider>
    </MemoryRouter>,
  );
}

describe('PartnerStaffPageContent (apps/web/src/modules/partner)', () => {
  let inviteMutateAsync;
  let removeMutateAsync;
  let revokeMutateAsync;

  beforeEach(() => {
    vi.clearAllMocks();
    inviteMutateAsync = vi.fn().mockResolvedValue({});
    removeMutateAsync = vi.fn().mockResolvedValue({});
    revokeMutateAsync = vi.fn().mockResolvedValue({});

    useStaffQuery.mockReturnValue({ data: STAFF, isPending: false });
    useStaffInvitationsQuery.mockReturnValue({
      data: INVITATIONS,
      isPending: false,
    });
    useInviteStaffMutation.mockReturnValue({
      mutateAsync: inviteMutateAsync,
      isPending: false,
    });
    useRevokeInvitationMutation.mockReturnValue({
      mutateAsync: revokeMutateAsync,
      isPending: false,
    });
    useUpdateStaffRoleMutation.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    });
    useRemoveStaffMutation.mockReturnValue({
      mutateAsync: removeMutateAsync,
      isPending: false,
    });
  });

  test('an OWNER sees the roster, pending invitations, and can invite a new staff member', async () => {
    usePartnerContext.mockReturnValue({
      activePartnerId: 3,
      activePartner: { role: 'OWNER' },
    });
    const user = userEvent.setup();
    renderPage();

    // Sprint 4: each row now renders twice in the DOM — once in the
    // desktop `DataTable` (a real `<table>`), once in an aria-labeled
    // mobile card `<ul>` — CSS-toggled by breakpoint, not conditionally
    // mounted. jsdom's default viewport doesn't match the `tablet`
    // breakpoint, so only the mobile lists are accessible here; scope to
    // them by their aria-label so assertions don't ambiguously match
    // both renderings (and don't depend on jsdom's media-query fidelity).
    const staffList = screen.getByRole('list', { name: 'Թիմի անդամներ' });
    const invitationsList = screen.getByRole('list', {
      name: 'Սպասող հրավերներ',
    });

    expect(
      within(staffList).getByText('owner@example.com'),
    ).toBeInTheDocument();
    expect(
      within(staffList).getByText('editor@example.com'),
    ).toBeInTheDocument();
    expect(screen.getByText('Սպասող հրավերներ')).toBeInTheDocument();
    expect(
      within(invitationsList).getByText('pending@example.com'),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: 'Հրավիրել աշխատակցի' }),
    );
    await user.type(
      screen.getByLabelText(/Էլ\. փոստի հասցե/),
      'newperson@example.com',
    );
    await user.click(screen.getByRole('button', { name: 'Ուղարկել հրավերը' }));

    await waitFor(() => {
      expect(inviteMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'newperson@example.com',
          roleCode: 'EDITOR',
          locale: 'hy',
        }),
      );
    });
  });

  test('a non-manager (EDITOR) sees the roster but no invite action and no pending invitations section', () => {
    usePartnerContext.mockReturnValue({
      activePartnerId: 3,
      activePartner: { role: 'EDITOR' },
    });
    renderPage();

    // No MANAGE_STAFF capability → no invitations section renders at all.
    const staffList = screen.getByRole('list', { name: 'Թիմի անդամներ' });
    expect(
      within(staffList).getByText('owner@example.com'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Հրավիրել աշխատակցի' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Սպասող հրավերներ')).not.toBeInTheDocument();
  });

  test('removing a staff member asks for confirmation, then calls the mutation on confirm', async () => {
    usePartnerContext.mockReturnValue({
      activePartnerId: 3,
      activePartner: { role: 'OWNER' },
    });
    const user = userEvent.setup();
    renderPage();

    const staffList = screen.getByRole('list', { name: 'Թիմի անդամներ' });
    await user.click(
      within(staffList).getByRole('button', { name: 'Հեռացնել' }),
    );
    expect(screen.getByText('Հեռացնե՞լ Ed Itor֊ին։')).toBeInTheDocument();

    const removeButtons = screen.getAllByRole('button', {
      name: 'Այո, հեռացնել',
    });
    await user.click(removeButtons[removeButtons.length - 1]);

    expect(removeMutateAsync).toHaveBeenCalledWith(2);
  });

  test('revoking a pending invitation asks for confirmation, then calls the mutation on confirm', async () => {
    usePartnerContext.mockReturnValue({
      activePartnerId: 3,
      activePartner: { role: 'OWNER' },
    });
    const user = userEvent.setup();
    renderPage();

    const invitationsList = screen.getByRole('list', {
      name: 'Սպասող հրավերներ',
    });
    await user.click(
      within(invitationsList).getByRole('button', { name: 'Չեղարկել' }),
    );
    const revokeButtons = screen.getAllByRole('button', {
      name: 'Այո, չեղարկել',
    });
    await user.click(revokeButtons[revokeButtons.length - 1]);

    expect(revokeMutateAsync).toHaveBeenCalledWith(5);
  });
});
