import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ToastProvider from '../../../../providers/ToastProvider.jsx';
import ConfirmProvider from '../../../../providers/ConfirmProvider.jsx';
import AdminReviewModerationPageContent from './AdminReviewModerationPageContent.jsx';
import { useAdminReviewsQuery } from '../../queries/useAdminReviewsQuery.js';
import { useUpdateReviewModerationStatusMutation } from '../../mutations/useUpdateReviewModerationStatusMutation.js';

vi.mock('../../queries/useAdminReviewsQuery.js', () => ({
  useAdminReviewsQuery: vi.fn(),
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

  test('a review with no reports shows a dash, not a report count', () => {
    useAdminReviewsQuery.mockReturnValue({
      data: { pages: [{ results: [reviewFixture({ report_count: 0 })] }] },
      isPending: false,
      isError: false,
      ...noopQueryExtras,
    });
    renderPage();

    expect(screen.queryByText(/Բողոքներ՝/)).not.toBeInTheDocument();
  });

  test('a reported review shows the real report count and links to its detail page', () => {
    useAdminReviewsQuery.mockReturnValue({
      data: {
        pages: [{ results: [reviewFixture({ id: 5, report_count: 2 })] }],
      },
      isPending: false,
      isError: false,
      ...noopQueryExtras,
    });
    renderPage();

    expect(screen.getByText('Բողոքներ՝ 2')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'It was okay.' })).toHaveAttribute(
      'href',
      '/hy/admin/reviews/5',
    );
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
});
