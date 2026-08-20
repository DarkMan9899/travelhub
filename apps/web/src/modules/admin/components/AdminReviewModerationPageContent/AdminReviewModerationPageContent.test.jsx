import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ToastProvider from '../../../../providers/ToastProvider.jsx';
import ConfirmProvider from '../../../../providers/ConfirmProvider.jsx';
import AdminReviewModerationPageContent from './AdminReviewModerationPageContent.jsx';
import { useAdminReviewsQuery } from '../../queries/useAdminReviewsQuery.js';
import { useAdminReviewDetailQuery } from '../../queries/useAdminReviewDetailQuery.js';
import { useUpdateReviewModerationStatusMutation } from '../../mutations/useUpdateReviewModerationStatusMutation.js';

vi.mock('../../queries/useAdminReviewsQuery.js', () => ({
  useAdminReviewsQuery: vi.fn(),
}));
vi.mock('../../queries/useAdminReviewDetailQuery.js', () => ({
  useAdminReviewDetailQuery: vi.fn(),
}));
vi.mock('../../mutations/useUpdateReviewModerationStatusMutation.js', () => ({
  useUpdateReviewModerationStatusMutation: vi.fn(),
}));

function reviewFixture(overrides) {
  return {
    id: 1,
    listing_title: 'Cozy Mountain Cabin',
    customer_display_name: 'Anna K.',
    rating: 3,
    content: 'It was okay.',
    status: 'APPROVED',
    report_count: 0,
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/hy/admin/reviews']}>
      <ToastProvider>
        <ConfirmProvider>
          <Routes>
            <Route
              path="/:locale/admin/reviews"
              element={<AdminReviewModerationPageContent />}
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

describe('AdminReviewModerationPageContent (apps/web/src/modules/admin)', () => {
  let mutateAsync;

  beforeEach(() => {
    mutateAsync = vi.fn().mockResolvedValue({});
    useUpdateReviewModerationStatusMutation.mockReturnValue({
      mutateAsync,
      isPending: false,
      variables: undefined,
    });
    useAdminReviewDetailQuery.mockReturnValue({
      data: undefined,
      isPending: true,
    });
  });

  test('shows a retryable error state', async () => {
    const refetch = vi.fn();
    useAdminReviewsQuery.mockReturnValue({
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

  test('renders real review rows with listing/customer/rating/status', () => {
    useAdminReviewsQuery.mockReturnValue({
      data: { pages: [{ results: [reviewFixture()] }] },
      isPending: false,
      isError: false,
      ...noopQueryExtras,
    });
    renderPage();

    expect(screen.getByText('Cozy Mountain Cabin')).toBeInTheDocument();
    expect(screen.getByText('Anna K.')).toBeInTheDocument();
    expect(screen.getByText('It was okay.')).toBeInTheDocument();
    expect(screen.getByText('Հաստատված')).toBeInTheDocument();
  });

  test('a review with no reports shows no "View reports" action', () => {
    useAdminReviewsQuery.mockReturnValue({
      data: { pages: [{ results: [reviewFixture({ report_count: 0 })] }] },
      isPending: false,
      isError: false,
      ...noopQueryExtras,
    });
    renderPage();

    // A plain regex on "Հայտնումներ" would also match the Reports filter
    // Select's own trigger (its `ariaLabel` is that same word) — the
    // row's "View reports" button always has a "(<count>)" suffix, the
    // filter never does.
    expect(
      screen.queryByRole('button', { name: /Հայտնումներ \(/ }),
    ).not.toBeInTheDocument();
  });

  test('approving a review asks for confirmation, then calls the mutation on confirm', async () => {
    useAdminReviewsQuery.mockReturnValue({
      data: { pages: [{ results: [reviewFixture()] }] },
      isPending: false,
      isError: false,
      ...noopQueryExtras,
    });
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Հաստատել' }));
    expect(screen.getByText('Հաստատե՞լ այս կարծիքը։')).toBeInTheDocument();

    const approveButtons = screen.getAllByRole('button', { name: 'Հաստատել' });
    await user.click(approveButtons[approveButtons.length - 1]);
    expect(mutateAsync).toHaveBeenCalledWith({ id: 1, status: 'APPROVED' });
  });

  test('rejecting a review opens the notes dialog and submits the typed notes', async () => {
    useAdminReviewsQuery.mockReturnValue({
      data: { pages: [{ results: [reviewFixture()] }] },
      isPending: false,
      isError: false,
      ...noopQueryExtras,
    });
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Մերժել' }));
    expect(screen.getByText('Մերժե՞լ այս կարծիքը։')).toBeInTheDocument();

    await user.type(
      screen.getByLabelText('Նշումներ (կամընտիր)'),
      'Guideline violation',
    );
    const rejectButtons = screen.getAllByRole('button', { name: 'Մերժել' });
    await user.click(rejectButtons[rejectButtons.length - 1]);

    expect(mutateAsync).toHaveBeenCalledWith({
      id: 1,
      status: 'REJECTED',
      notes: 'Guideline violation',
    });
  });

  test('viewing reports on a reported review shows the reason', async () => {
    useAdminReviewsQuery.mockReturnValue({
      data: { pages: [{ results: [reviewFixture({ report_count: 2 })] }] },
      isPending: false,
      isError: false,
      ...noopQueryExtras,
    });
    useAdminReviewDetailQuery.mockReturnValue({
      data: {
        reports: [{ id: 1, reason_name: 'Spam or advertising', details: null }],
      },
      isPending: false,
    });
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /Հայտնումներ \(2\)/ }));
    expect(screen.getByText('Spam or advertising')).toBeInTheDocument();
  });
});
