import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ToastProvider from '../../../../providers/ToastProvider.jsx';
import ConfirmProvider from '../../../../providers/ConfirmProvider.jsx';
import AdminPartnerDetailContent from './AdminPartnerDetailContent.jsx';
import { useAdminPartnerDetailQuery } from '../../queries/useAdminPartnerDetailQuery.js';
import { useAdminPartnerBookingsQuery } from '../../queries/useAdminPartnerBookingsQuery.js';
import { useUpdatePartnerVerificationStatusMutation } from '../../mutations/useUpdatePartnerVerificationStatusMutation.js';
import { useUpdatePartnerModerationStatusMutation } from '../../mutations/useUpdatePartnerModerationStatusMutation.js';
import { useAuth } from '../../../../contexts/AuthContext.jsx';

vi.mock('../../queries/useAdminPartnerDetailQuery.js', () => ({
  useAdminPartnerDetailQuery: vi.fn(),
}));
vi.mock('../../queries/useAdminPartnerBookingsQuery.js', () => ({
  useAdminPartnerBookingsQuery: vi.fn(),
}));
vi.mock(
  '../../mutations/useUpdatePartnerVerificationStatusMutation.js',
  () => ({
    useUpdatePartnerVerificationStatusMutation: vi.fn(),
  }),
);
vi.mock('../../mutations/useUpdatePartnerModerationStatusMutation.js', () => ({
  useUpdatePartnerModerationStatusMutation: vi.fn(),
}));
vi.mock('../../../../contexts/AuthContext.jsx', () => ({ useAuth: vi.fn() }));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/hy/admin/partners/1']}>
      <ToastProvider>
        <ConfirmProvider>
          <Routes>
            <Route
              path="/:locale/admin/partners/:id"
              element={<AdminPartnerDetailContent />}
            />
          </Routes>
        </ConfirmProvider>
      </ToastProvider>
    </MemoryRouter>,
  );
}

describe('AdminPartnerDetailContent (apps/web/src/modules/admin)', () => {
  beforeEach(() => {
    useAuth.mockReturnValue({
      permissions: ['partner.verify', 'partner.moderate'],
    });
  });

  test('shows a retryable error state', () => {
    const refetch = vi.fn();
    useAdminPartnerDetailQuery.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
      refetch,
    });
    useAdminPartnerBookingsQuery.mockReturnValue({
      data: undefined,
      isPending: true,
    });
    useUpdatePartnerVerificationStatusMutation.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    });
    useUpdatePartnerModerationStatusMutation.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    });
    renderPage();

    expect(
      screen.getByText('Չհաջողվեց բեռնել այս գործընկերոջը։'),
    ).toBeInTheDocument();
  });

  test('renders profile, owner, stats, and real booking history', () => {
    useAdminPartnerDetailQuery.mockReturnValue({
      data: {
        id: 1,
        slug: 'yerevan-boutique-hospitality',
        display_name: 'Yerevan Boutique Hospitality',
        email: 'vendor@travelhub.dev',
        verification_status: 'APPROVED',
        moderation_status: 'APPROVED',
        total_listing_count: 8,
        published_listing_count: 5,
        owner: {
          email: 'vendor@travelhub.dev',
          first_name: 'Dev',
          last_name: 'Vendor',
        },
      },
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    });
    useAdminPartnerBookingsQuery.mockReturnValue({
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
    useUpdatePartnerVerificationStatusMutation.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    });
    useUpdatePartnerModerationStatusMutation.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    });
    renderPage();

    expect(screen.getByText('vendor@travelhub.dev')).toBeInTheDocument();
    expect(
      screen.getByText('Dev Vendor (vendor@travelhub.dev)', {
        exact: false,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText('BK-1')).toBeInTheDocument();
  });

  test('shows an empty state when there is no booking history', () => {
    useAdminPartnerDetailQuery.mockReturnValue({
      data: {
        id: 2,
        slug: 'ararat-grand-hotels',
        display_name: 'Ararat Grand Hotels',
        email: 'partner.hotels@example.com',
        verification_status: 'PENDING',
        moderation_status: 'APPROVED',
        total_listing_count: 0,
        published_listing_count: 0,
        owner: null,
      },
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    });
    useAdminPartnerBookingsQuery.mockReturnValue({
      data: [],
      isPending: false,
    });
    useUpdatePartnerVerificationStatusMutation.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    });
    useUpdatePartnerModerationStatusMutation.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    });
    renderPage();

    expect(
      screen.getByText('Սեփականատեր գրանցված չէ', { exact: false }),
    ).toBeInTheDocument();
    expect(screen.getByText('Ամրագրումներ դեռ չկան։')).toBeInTheDocument();
  });
});
