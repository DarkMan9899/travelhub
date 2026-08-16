import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PartnerProvider from './PartnerProvider.jsx';
import { usePartnerContext } from '../contexts/PartnerContext.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';

vi.mock('../contexts/AuthContext.jsx', () => ({ useAuth: vi.fn() }));

function Consumer() {
  const { activePartnerId, activePartner, partnerships, setActivePartnerId } =
    usePartnerContext();
  return (
    <div>
      <p data-testid="active-id">{activePartnerId}</p>
      <p data-testid="active-name">{activePartner?.display_name}</p>
      {partnerships.map((p) => (
        <button
          key={p.partner_id}
          type="button"
          onClick={() => setActivePartnerId(p.partner_id)}
        >
          {p.display_name}
        </button>
      ))}
    </div>
  );
}

describe('PartnerProvider (apps/web/src/providers)', () => {
  test('defaults activePartnerId to the first partnership', () => {
    useAuth.mockReturnValue({
      partnerships: [
        { partner_id: 1, slug: 'a', display_name: 'Alpha', role: 'OWNER' },
        { partner_id: 2, slug: 'b', display_name: 'Beta', role: 'MANAGER' },
      ],
    });
    render(
      <PartnerProvider>
        <Consumer />
      </PartnerProvider>,
    );
    expect(screen.getByTestId('active-id')).toHaveTextContent('1');
    expect(screen.getByTestId('active-name')).toHaveTextContent('Alpha');
  });

  test('setActivePartnerId switches the active partnership', async () => {
    useAuth.mockReturnValue({
      partnerships: [
        { partner_id: 1, slug: 'a', display_name: 'Alpha', role: 'OWNER' },
        { partner_id: 2, slug: 'b', display_name: 'Beta', role: 'MANAGER' },
      ],
    });
    const user = userEvent.setup();
    render(
      <PartnerProvider>
        <Consumer />
      </PartnerProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Beta' }));

    expect(screen.getByTestId('active-id')).toHaveTextContent('2');
    expect(screen.getByTestId('active-name')).toHaveTextContent('Beta');
  });

  test('activePartnerId is null when the user has no partnerships', () => {
    useAuth.mockReturnValue({ partnerships: [] });
    render(
      <PartnerProvider>
        <Consumer />
      </PartnerProvider>,
    );
    expect(screen.getByTestId('active-id')).toHaveTextContent('');
    expect(screen.getByTestId('active-name')).toHaveTextContent('');
  });
});
