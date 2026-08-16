import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ToastProvider from '../../../../providers/ToastProvider.jsx';
import ConfirmProvider from '../../../../providers/ConfirmProvider.jsx';
import AdminPartnersPageContent from './AdminPartnersPageContent.jsx';
import { useAdminPartnersQuery } from '../../queries/useAdminPartnersQuery.js';
import { useUpdatePartnerModerationStatusMutation } from '../../mutations/useUpdatePartnerModerationStatusMutation.js';
import { useAuth } from '../../../../contexts/AuthContext.jsx';

vi.mock('../../queries/useAdminPartnersQuery.js', () => ({
  useAdminPartnersQuery: vi.fn(),
}));
vi.mock('../../mutations/useUpdatePartnerModerationStatusMutation.js', () => ({
  useUpdatePartnerModerationStatusMutation: vi.fn(),
}));
vi.mock('../../../../contexts/AuthContext.jsx', () => ({ useAuth: vi.fn() }));

function partnerFixture(overrides) {
  return {
    id: 1,
    slug: 'yerevan-boutique-hospitality',
    display_name: 'Yerevan Boutique Hospitality',
    email: 'vendor@travelhub.dev',
    verification_status: 'APPROVED',
    moderation_status: 'APPROVED',
    listing_count: 5,
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/hy/admin/partners']}>
      <ToastProvider>
        <ConfirmProvider>
          <Routes>
            <Route
              path="/:locale/admin/partners"
              element={<AdminPartnersPageContent />}
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

describe('AdminPartnersPageContent (apps/web/src/modules/admin)', () => {
  let mutateAsync;

  beforeEach(() => {
    mutateAsync = vi.fn().mockResolvedValue({});
    useUpdatePartnerModerationStatusMutation.mockReturnValue({
      mutateAsync,
      isPending: false,
      variables: undefined,
    });
    useAuth.mockReturnValue({ permissions: ['partner.moderate'] });
  });

  test('shows a retryable error state', async () => {
    const refetch = vi.fn();
    useAdminPartnersQuery.mockReturnValue({
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

  test('renders real partner rows with email/status/listing count', () => {
    useAdminPartnersQuery.mockReturnValue({
      data: { pages: [{ results: [partnerFixture()] }] },
      isPending: false,
      isError: false,
      ...noopQueryExtras,
    });
    renderPage();

    expect(screen.getByText('vendor@travelhub.dev')).toBeInTheDocument();
    expect(screen.getByText('Հաստատված')).toBeInTheDocument();
    expect(screen.getByText('Տեսանելի')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  test('suspending a partner asks for confirmation, then calls the mutation on confirm', async () => {
    useAdminPartnersQuery.mockReturnValue({
      data: { pages: [{ results: [partnerFixture()] }] },
      isPending: false,
      isError: false,
      ...noopQueryExtras,
    });
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Կասեցնել' }));
    expect(
      screen.getByText('Կասեցնե՞լ Yerevan Boutique Hospitality-ին։'),
    ).toBeInTheDocument();

    const suspendButtons = screen.getAllByRole('button', { name: 'Կասեցնել' });
    await user.click(suspendButtons[suspendButtons.length - 1]);
    expect(mutateAsync).toHaveBeenCalledWith({ id: 1, status: 'FLAGGED' });
  });
});
