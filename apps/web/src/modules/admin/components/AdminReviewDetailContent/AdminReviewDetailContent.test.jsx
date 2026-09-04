import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ToastProvider from '../../../../providers/ToastProvider.jsx';
import ConfirmProvider from '../../../../providers/ConfirmProvider.jsx';
import AdminReviewDetailContent from './AdminReviewDetailContent.jsx';
import { useAdminReviewDetailQuery } from '../../queries/useAdminReviewDetailQuery.js';
import { useUpdateReviewModerationStatusMutation } from '../../mutations/useUpdateReviewModerationStatusMutation.js';
import { useAuth } from '../../../../contexts/AuthContext.jsx';

vi.mock('../../queries/useAdminReviewDetailQuery.js', () => ({
  useAdminReviewDetailQuery: vi.fn(),
}));
vi.mock('../../mutations/useUpdateReviewModerationStatusMutation.js', () => ({
  useUpdateReviewModerationStatusMutation: vi.fn(),
}));
vi.mock('../../../../contexts/AuthContext.jsx', () => ({ useAuth: vi.fn() }));

const BASE_REVIEW = {
  id: 4,
  customer_user_id: 9,
  listing_id: 12,
  rating: 4,
  title: null,
  content: 'Great stay, would come back.',
  status: 'APPROVED',
  customer_display_name: 'Ana Smith',
  listing_title: 'Boutique Room',
  moderation_notes: null,
  moderated_at: null,
  moderated_by: null,
  report_count: 0,
  created_at: '2026-07-01T10:00:00.000Z',
  reports: [],
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/hy/admin/reviews/4']}>
      <ToastProvider>
        <ConfirmProvider>
          <Routes>
            <Route
              path="/:locale/admin/reviews/:id"
              element={<AdminReviewDetailContent />}
            />
          </Routes>
        </ConfirmProvider>
      </ToastProvider>
    </MemoryRouter>,
  );
}

describe('AdminReviewDetailContent (apps/web/src/modules/admin)', () => {
  let mutateAsync;

  beforeEach(() => {
    mutateAsync = vi.fn().mockResolvedValue({});
    useUpdateReviewModerationStatusMutation.mockReturnValue({
      mutateAsync,
      isPending: false,
      variables: undefined,
    });
    useAuth.mockReturnValue({ permissions: ['review.moderate'] });
  });

  test('renders identity, author, and listing links', () => {
    useAdminReviewDetailQuery.mockReturnValue({
      data: BASE_REVIEW,
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
    renderPage();

    expect(
      screen.getByText('Great stay, would come back.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ana Smith' })).toHaveAttribute(
      'href',
      '/hy/admin/users/9',
    );
    expect(screen.getByRole('link', { name: 'Boutique Room' })).toHaveAttribute(
      'href',
      '/hy/admin/listings/12',
    );
  });

  test('shows no reports empty state when the review has none', () => {
    useAdminReviewDetailQuery.mockReturnValue({
      data: BASE_REVIEW,
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
    renderPage();

    expect(
      screen.getByText('Այս կարծիքի վերաբերյալ բողոքներ չկան։'),
    ).toBeInTheDocument();
  });

  test('renders each report with a localized reason (not the raw English reason_name) and a reporter link', () => {
    useAdminReviewDetailQuery.mockReturnValue({
      data: {
        ...BASE_REVIEW,
        reports: [
          {
            id: 1,
            reporter_user_id: 21,
            reason: 'SPAM',
            reason_name: 'Spam or advertising',
            details: 'Looks like a bot review.',
            created_at: '2026-07-02T09:00:00.000Z',
            resolved_at: null,
          },
        ],
      },
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
    renderPage();

    expect(screen.getByText('Սպամ')).toBeInTheDocument();
    expect(screen.queryByText('Spam or advertising')).not.toBeInTheDocument();
    expect(screen.getByText('Looks like a bot review.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Օգտատեր #21' })).toHaveAttribute(
      'href',
      '/hy/admin/users/21',
    );
  });

  test('approving calls the mutation with the real review id', async () => {
    useAdminReviewDetailQuery.mockReturnValue({
      data: BASE_REVIEW,
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Հաստատել' }));
    const confirmButtons = screen.getAllByRole('button', { name: 'Հաստատել' });
    await user.click(confirmButtons[confirmButtons.length - 1]);

    expect(mutateAsync).toHaveBeenCalledWith({ id: 4, status: 'APPROVED' });
  });

  test('moderation actions are hidden without review.moderate', () => {
    useAuth.mockReturnValue({ permissions: [] });
    useAdminReviewDetailQuery.mockReturnValue({
      data: BASE_REVIEW,
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
    renderPage();

    expect(
      screen.queryByRole('button', { name: 'Հաստատել' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Մերժել' }),
    ).not.toBeInTheDocument();
  });

  test('renders a 404 empty state for a genuine not-found error', () => {
    useAdminReviewDetailQuery.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
      error: { status: 404 },
      refetch: vi.fn(),
    });
    renderPage();
    expect(
      screen.getByRole('heading', { name: 'Էջը չի գտնվել' }),
    ).toBeInTheDocument();
  });

  test('renders a retryable error state for a non-404 error', () => {
    useAdminReviewDetailQuery.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
      error: { status: 500 },
      refetch: vi.fn(),
    });
    renderPage();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});
