import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import UserMenu from './UserMenu.jsx';
import { useAuth } from '../../contexts/AuthContext.jsx';

vi.mock('../../contexts/AuthContext.jsx', () => ({ useAuth: vi.fn() }));

function renderMenu() {
  return render(
    <MemoryRouter initialEntries={['/hy']}>
      <Routes>
        <Route path="/:locale" element={<UserMenu />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('UserMenu (apps/web/src/components)', () => {
  test('logged-in menu links to Overview, Profile, and Settings (Phase 8)', async () => {
    useAuth.mockReturnValue({
      isAuthenticated: true,
      isBootstrapping: false,
      user: { id: 1, first_name: 'Ana', last_name: 'Smith' },
      logout: vi.fn(),
    });
    const user = userEvent.setup();
    renderMenu();

    await user.click(screen.getByRole('button', { name: 'Հաշվի ընտրացանկ' }));

    expect(screen.getByRole('menuitem', { name: 'Իմ հաշիվը' })).toHaveAttribute(
      'href',
      '/hy/account',
    );
    expect(
      screen.getByRole('menuitem', { name: 'Անձնական տվյալներ' }),
    ).toHaveAttribute('href', '/hy/account/profile');
    expect(
      screen.getByRole('menuitem', { name: 'Կարգավորումներ' }),
    ).toHaveAttribute('href', '/hy/account/settings');
  });

  test('a user with no partnerships sees no Workspace section (Phase 10)', async () => {
    useAuth.mockReturnValue({
      isAuthenticated: true,
      isBootstrapping: false,
      user: { id: 1, first_name: 'Ana', last_name: 'Smith' },
      partnerships: [],
      logout: vi.fn(),
    });
    const user = userEvent.setup();
    renderMenu();

    await user.click(screen.getByRole('button', { name: 'Հաշվի ընտրացանկ' }));

    expect(
      screen.queryByRole('menuitem', { name: 'Գործընկերոջ վահանակ' }),
    ).not.toBeInTheDocument();
  });

  test('a user with partnerships sees a Workspace section and can switch (Phase 10)', async () => {
    useAuth.mockReturnValue({
      isAuthenticated: true,
      isBootstrapping: false,
      user: { id: 1, first_name: 'Ana', last_name: 'Smith' },
      partnerships: [{ partner_id: 1 }],
      logout: vi.fn(),
    });
    const user = userEvent.setup();
    renderMenu();

    await user.click(screen.getByRole('button', { name: 'Հաշվի ընտրացանկ' }));
    const partnerItem = screen.getByRole('menuitem', {
      name: 'Գործընկերոջ վահանակ',
    });
    expect(partnerItem).toBeInTheDocument();

    await user.click(partnerItem);
    expect(window.localStorage.getItem('desavii:lastWorkspace')).toBe(
      'partner',
    );
  });
});
