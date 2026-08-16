import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import RequirePartner from './RequirePartner.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';

vi.mock('../contexts/AuthContext.jsx', () => ({
  useAuth: vi.fn(),
}));

function renderGuarded() {
  return render(
    <MemoryRouter initialEntries={['/hy/partner']}>
      <Routes>
        <Route
          path="/:locale/partner"
          element={
            <RequirePartner>
              <div>Partner content</div>
            </RequirePartner>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('RequirePartner (apps/web/src/guards)', () => {
  test('renders children when the user has at least one partnership', () => {
    useAuth.mockReturnValue({
      partnerships: [{ partner_id: 1, slug: 'yerevan-boutique-hospitality' }],
    });
    renderGuarded();
    expect(screen.getByText('Partner content')).toBeInTheDocument();
  });

  test('renders ForbiddenPage when the user has no partnerships', () => {
    useAuth.mockReturnValue({ partnerships: [] });
    renderGuarded();
    expect(screen.queryByText('Partner content')).not.toBeInTheDocument();
  });
});
