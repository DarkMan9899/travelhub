import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ToastProvider from '../../../../providers/ToastProvider.jsx';
import ConfirmProvider from '../../../../providers/ConfirmProvider.jsx';
import AdminListingModerationPageContent from './AdminListingModerationPageContent.jsx';
import { useAdminListingsQuery } from '../../queries/useAdminListingsQuery.js';
import { useUpdateListingModerationStatusMutation } from '../../mutations/useUpdateListingModerationStatusMutation.js';

vi.mock('../../queries/useAdminListingsQuery.js', () => ({
  useAdminListingsQuery: vi.fn(),
}));
vi.mock('../../mutations/useUpdateListingModerationStatusMutation.js', () => ({
  useUpdateListingModerationStatusMutation: vi.fn(),
}));

function listingFixture(overrides) {
  return {
    id: 1,
    title: 'Cozy Mountain Cabin',
    partner_display_name: 'Highland Experiences',
    status: 'DRAFT',
    moderation_status: 'PENDING',
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/hy/admin/listings']}>
      <ToastProvider>
        <ConfirmProvider>
          <Routes>
            <Route
              path="/:locale/admin/listings"
              element={<AdminListingModerationPageContent />}
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

describe('AdminListingModerationPageContent (apps/web/src/modules/admin)', () => {
  let mutateAsync;

  beforeEach(() => {
    mutateAsync = vi.fn().mockResolvedValue({});
    useUpdateListingModerationStatusMutation.mockReturnValue({
      mutateAsync,
      isPending: false,
      variables: undefined,
    });
  });

  test('shows a retryable error state', async () => {
    const refetch = vi.fn();
    useAdminListingsQuery.mockReturnValue({
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

  test('renders real listing rows with title/partner/status/moderation', () => {
    useAdminListingsQuery.mockReturnValue({
      data: { pages: [{ results: [listingFixture()] }] },
      isPending: false,
      isError: false,
      ...noopQueryExtras,
    });
    renderPage();

    expect(screen.getByText('Cozy Mountain Cabin')).toBeInTheDocument();
    expect(screen.getByText('Highland Experiences')).toBeInTheDocument();
    expect(screen.getByText('Սևագիր')).toBeInTheDocument();
    // Appears twice: the row's own moderation badge, and the moderation
    // filter Select's trigger (default filter is `moderationStatus=PENDING`,
    // same label text).
    expect(screen.getAllByText('Սպասման մեջ')).toHaveLength(2);
  });

  test('approving a listing asks for confirmation, then calls the mutation on confirm', async () => {
    useAdminListingsQuery.mockReturnValue({
      data: { pages: [{ results: [listingFixture()] }] },
      isPending: false,
      isError: false,
      ...noopQueryExtras,
    });
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Հաստատել' }));
    expect(
      screen.getByText('Հաստատե՞լ «Cozy Mountain Cabin»-ը։'),
    ).toBeInTheDocument();

    const approveButtons = screen.getAllByRole('button', { name: 'Հաստատել' });
    await user.click(approveButtons[approveButtons.length - 1]);
    expect(mutateAsync).toHaveBeenCalledWith({ id: 1, status: 'APPROVED' });
  });

  test('rejecting a listing opens the notes dialog and submits the typed notes', async () => {
    useAdminListingsQuery.mockReturnValue({
      data: { pages: [{ results: [listingFixture()] }] },
      isPending: false,
      isError: false,
      ...noopQueryExtras,
    });
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Մերժել' }));
    expect(
      screen.getByText('Մերժե՞լ «Cozy Mountain Cabin»-ը։'),
    ).toBeInTheDocument();

    await user.type(
      screen.getByLabelText('Նշումներ (կամընտիր)'),
      'Missing photos',
    );
    const rejectButtons = screen.getAllByRole('button', { name: 'Մերժել' });
    await user.click(rejectButtons[rejectButtons.length - 1]);

    expect(mutateAsync).toHaveBeenCalledWith({
      id: 1,
      status: 'REJECTED',
      notes: 'Missing photos',
    });
  });
});
