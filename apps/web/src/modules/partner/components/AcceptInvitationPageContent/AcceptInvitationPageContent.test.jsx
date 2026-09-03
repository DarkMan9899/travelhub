import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ToastProvider from '../../../../providers/ToastProvider.jsx';
import AcceptInvitationPageContent from './AcceptInvitationPageContent.jsx';
import { useAuth } from '../../../../contexts/AuthContext.jsx';
import { useInvitationPreviewQuery } from '../../queries/useInvitationPreviewQuery.js';
import { useAcceptInvitationMutation } from '../../mutations/useAcceptInvitationMutation.js';

vi.mock('../../../../contexts/AuthContext.jsx', () => ({ useAuth: vi.fn() }));
vi.mock('../../queries/useInvitationPreviewQuery.js', () => ({
  useInvitationPreviewQuery: vi.fn(),
}));
vi.mock('../../mutations/useAcceptInvitationMutation.js', () => ({
  useAcceptInvitationMutation: vi.fn(),
}));

const PREVIEW = {
  partner_name: 'Dilijan Adventures',
  role_name: 'Editor',
  email: 'invitee@example.com',
};

// This app's default/fallback i18next language is Armenian ('hy') — see
// `PartnerStaffPageContent.test.jsx`'s own comment for why a bare
// component test renders `hy` regardless of the route param.
function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/hy/partner/invitations/abc123']}>
      <ToastProvider>
        <Routes>
          <Route
            path="/:locale/partner/invitations/:token"
            element={<AcceptInvitationPageContent />}
          />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
  );
}

describe('AcceptInvitationPageContent (apps/web/src/modules/partner)', () => {
  let refreshUser;

  beforeEach(() => {
    vi.clearAllMocks();
    refreshUser = vi.fn().mockResolvedValue({});
    useAuth.mockReturnValue({
      user: { email: 'invitee@example.com' },
      refreshUser,
    });
  });

  test('shows an error state for an invalid/expired invitation', () => {
    useInvitationPreviewQuery.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
      error: { code: 'NOT_FOUND' },
    });
    useAcceptInvitationMutation.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    });
    renderPage();

    expect(screen.getByText('Հրավերը չի գտնվել')).toBeInTheDocument();
  });

  test('shows the expired-specific message when the invitation has expired', () => {
    useInvitationPreviewQuery.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
      error: { code: 'INVITATION_EXPIRED' },
    });
    useAcceptInvitationMutation.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    });
    renderPage();

    expect(screen.getByText('Հրավերի ժամկետը լրացել է')).toBeInTheDocument();
  });

  test('a matching signed-in user can accept, which refreshes the session and navigates to the dashboard', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({});
    useInvitationPreviewQuery.mockReturnValue({
      data: PREVIEW,
      isPending: false,
      isError: false,
    });
    useAcceptInvitationMutation.mockReturnValue({
      mutateAsync,
      isPending: false,
    });
    const user = userEvent.setup();
    renderPage();

    expect(
      screen.getByText('Միացեք Dilijan Adventures֊ին'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Ընդունել հրավերը' }));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith('abc123');
      expect(refreshUser).toHaveBeenCalled();
    });
  });

  test('a signed-in user whose email does not match the invitation sees a mismatch message, no accept button', () => {
    useAuth.mockReturnValue({
      user: { email: 'someone-else@example.com' },
      refreshUser,
    });
    useInvitationPreviewQuery.mockReturnValue({
      data: PREVIEW,
      isPending: false,
      isError: false,
    });
    useAcceptInvitationMutation.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    });
    renderPage();

    expect(
      screen.getByText(
        'Այս հրավերն ուղարկվել է invitee@example.com հասցեին։ Այն ընդունելու համար մուտք գործեք այդ էլ. փոստով։',
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Ընդունել հրավերը' }),
    ).not.toBeInTheDocument();
  });

  test('2026 SEO audit: sets an explicit noindex,nofollow robots meta tag — this URL carries a real single-use token', () => {
    useInvitationPreviewQuery.mockReturnValue({
      data: PREVIEW,
      isPending: false,
      isError: false,
    });
    useAcceptInvitationMutation.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    });
    renderPage();

    const robotsTag = document.querySelector('meta[name="robots"]');
    expect(robotsTag).not.toBeNull();
    expect(robotsTag.getAttribute('content')).toBe('noindex, nofollow');
  });
});
