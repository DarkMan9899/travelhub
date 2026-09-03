import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import StaffInvitationCard from './StaffInvitationCard.jsx';

function invitation(overrides) {
  return {
    id: 5,
    email: 'pending@example.com',
    role: 'MANAGER',
    role_name: 'Manager',
    expires_at: '2026-12-01T00:00:00.000Z',
    ...overrides,
  };
}

function renderCard({ invitation: invitationProp, onRevoke }) {
  return render(
    <MemoryRouter initialEntries={['/hy/partner/staff']}>
      <Routes>
        <Route
          path="/:locale/partner/staff"
          element={
            <ul>
              <StaffInvitationCard
                invitation={invitationProp}
                onRevoke={onRevoke}
              />
            </ul>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('StaffInvitationCard (apps/web/src/modules/partner)', () => {
  test('renders the invited email and a translated role, not the raw role_name', () => {
    renderCard({ invitation: invitation(), onRevoke: vi.fn() });

    expect(screen.getByText('pending@example.com')).toBeInTheDocument();
    expect(screen.getByText('Ղեկավար')).toBeInTheDocument();
    expect(screen.queryByText('Manager')).not.toBeInTheDocument();
  });

  test('an unmapped role code falls back to the raw role_name rather than rendering nothing', () => {
    renderCard({
      invitation: invitation({ role: 'FUTURE_ROLE', role_name: 'Future Role' }),
      onRevoke: vi.fn(),
    });

    expect(screen.getByText('Future Role')).toBeInTheDocument();
  });

  test('revoke calls onRevoke with the invitation', async () => {
    const onRevoke = vi.fn();
    const user = userEvent.setup();
    renderCard({ invitation: invitation(), onRevoke });

    await user.click(screen.getByRole('button', { name: 'Չեղարկել' }));
    expect(onRevoke).toHaveBeenCalledWith(invitation());
  });
});
