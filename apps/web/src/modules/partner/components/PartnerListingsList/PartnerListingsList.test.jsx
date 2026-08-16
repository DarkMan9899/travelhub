import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PropTypes from 'prop-types';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ToastProvider from '../../../../providers/ToastProvider.jsx';
import ConfirmProvider from '../../../../providers/ConfirmProvider.jsx';
import PartnerListingsList from './PartnerListingsList.jsx';
import {
  usePublishListingMutation,
  useUnpublishListingMutation,
  useArchiveListingMutation,
  useDeleteListingMutation,
} from '../../../listings/index.js';

vi.mock('../../../listings/index.js', () => {
  function MockListingStatusBadge({ status }) {
    return <span>{status}</span>;
  }
  MockListingStatusBadge.propTypes = { status: PropTypes.string.isRequired };
  return {
    usePublishListingMutation: vi.fn(),
    useUnpublishListingMutation: vi.fn(),
    useArchiveListingMutation: vi.fn(),
    useDeleteListingMutation: vi.fn(),
    ListingStatusBadge: MockListingStatusBadge,
  };
});

function listingFixture(overrides) {
  return {
    id: 1,
    title: 'Seaside Villa',
    slug: 'seaside-villa',
    listing_type: 'PROPERTY',
    status: 'DRAFT',
    cover_image_url: null,
    created_at: '2026-07-01T00:00:00Z',
    ...overrides,
  };
}

function renderList({
  listings = [],
  isPending = false,
  isError = false,
  onRetry = vi.fn(),
  hasNextPage = false,
  isFetchingNextPage = false,
  onLoadMore = vi.fn(),
} = {}) {
  return render(
    <MemoryRouter initialEntries={['/hy/partner/listings']}>
      <ToastProvider>
        <ConfirmProvider>
          <Routes>
            <Route
              path="/:locale/partner/listings"
              element={
                <PartnerListingsList
                  listings={listings}
                  isPending={isPending}
                  isError={isError}
                  onRetry={onRetry}
                  hasNextPage={hasNextPage}
                  isFetchingNextPage={isFetchingNextPage}
                  onLoadMore={onLoadMore}
                />
              }
            />
          </Routes>
        </ConfirmProvider>
      </ToastProvider>
    </MemoryRouter>,
  );
}

const noop = { isPending: false, variables: undefined };

describe('PartnerListingsList (apps/web/src/modules/partner)', () => {
  let publishMutateAsync;
  let unpublishMutateAsync;
  let archiveMutateAsync;
  let deleteMutateAsync;

  beforeEach(() => {
    publishMutateAsync = vi.fn().mockResolvedValue({});
    unpublishMutateAsync = vi.fn().mockResolvedValue({});
    archiveMutateAsync = vi.fn().mockResolvedValue({});
    deleteMutateAsync = vi.fn().mockResolvedValue({});
    usePublishListingMutation.mockReturnValue({
      ...noop,
      mutateAsync: publishMutateAsync,
    });
    useUnpublishListingMutation.mockReturnValue({
      ...noop,
      mutateAsync: unpublishMutateAsync,
    });
    useArchiveListingMutation.mockReturnValue({
      ...noop,
      mutateAsync: archiveMutateAsync,
    });
    useDeleteListingMutation.mockReturnValue({
      ...noop,
      mutateAsync: deleteMutateAsync,
    });
  });

  test('shows skeleton placeholders while pending', () => {
    renderList({
      listings: [],
      isPending: true,
      isError: false,
      onRetry: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      onLoadMore: vi.fn(),
    });
    expect(screen.queryByText('Seaside Villa')).not.toBeInTheDocument();
  });

  test('shows a retryable error state', async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup();
    renderList({
      listings: [],
      isPending: false,
      isError: true,
      onRetry,
      hasNextPage: false,
      isFetchingNextPage: false,
      onLoadMore: vi.fn(),
    });
    await user.click(screen.getByRole('button', { name: 'Կրկին փորձել' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  test('shows an empty state when there are no listings', () => {
    renderList({
      listings: [],
      isPending: false,
      isError: false,
      onRetry: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      onLoadMore: vi.fn(),
    });
    expect(
      screen.getByText('Ձեր ֆիլտրերին համապատասխան հայտարարություններ չկան'),
    ).toBeInTheDocument();
  });

  test('shows Publish for a DRAFT listing and not Unpublish', () => {
    renderList({
      listings: [listingFixture({ status: 'DRAFT' })],
      isPending: false,
      isError: false,
      onRetry: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      onLoadMore: vi.fn(),
    });
    expect(
      screen.getByRole('button', { name: 'Հրապարակել' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Հանել հրապարակումից' }),
    ).not.toBeInTheDocument();
  });

  test('shows Unpublish and Archive for a PUBLISHED listing and not Publish', () => {
    renderList({
      listings: [listingFixture({ status: 'PUBLISHED' })],
      isPending: false,
      isError: false,
      onRetry: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      onLoadMore: vi.fn(),
    });
    expect(
      screen.getByRole('button', { name: 'Հանել հրապարակումից' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Արխիվացնել' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Հրապարակել' }),
    ).not.toBeInTheDocument();
  });

  test('shows neither Publish/Unpublish/Archive for an ARCHIVED listing', () => {
    renderList({
      listings: [listingFixture({ status: 'ARCHIVED' })],
      isPending: false,
      isError: false,
      onRetry: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      onLoadMore: vi.fn(),
    });
    expect(
      screen.queryByRole('button', { name: 'Հրապարակել' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Հանել հրապարակումից' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Արխիվացնել' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ջնջել' })).toBeInTheDocument();
  });

  test('publishing calls the mutation and shows a success toast', async () => {
    const user = userEvent.setup();
    renderList({
      listings: [listingFixture({ id: 5, status: 'DRAFT' })],
      isPending: false,
      isError: false,
      onRetry: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      onLoadMore: vi.fn(),
    });
    await user.click(screen.getByRole('button', { name: 'Հրապարակել' }));
    await waitFor(() => expect(publishMutateAsync).toHaveBeenCalledWith(5));
    expect(
      await screen.findByText('Ձեր հայտարարությունը հրապարակվել է։'),
    ).toBeInTheDocument();
  });

  test('a failed publish shows the server error message as a toast', async () => {
    publishMutateAsync.mockRejectedValue({
      message: 'Add at least one photo before publishing.',
    });
    const user = userEvent.setup();
    renderList({
      listings: [listingFixture({ id: 5, status: 'DRAFT' })],
      isPending: false,
      isError: false,
      onRetry: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      onLoadMore: vi.fn(),
    });
    await user.click(screen.getByRole('button', { name: 'Հրապարակել' }));
    expect(
      await screen.findByText('Add at least one photo before publishing.'),
    ).toBeInTheDocument();
  });

  test('archiving requires confirmation, then calls the mutation and shows a success toast', async () => {
    const user = userEvent.setup();
    renderList({
      listings: [listingFixture({ id: 9, status: 'PUBLISHED' })],
      isPending: false,
      isError: false,
      onRetry: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      onLoadMore: vi.fn(),
    });
    await user.click(screen.getByRole('button', { name: 'Արխիվացնել' }));
    expect(archiveMutateAsync).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Այո, արխիվացնել' }));
    await waitFor(() => expect(archiveMutateAsync).toHaveBeenCalledWith(9));
    expect(
      await screen.findByText('Հայտարարությունը արխիվացվել է։'),
    ).toBeInTheDocument();
  });

  test('deleting requires confirmation, then calls the mutation and shows a success toast', async () => {
    const user = userEvent.setup();
    renderList({
      listings: [listingFixture({ id: 3, status: 'PUBLISHED' })],
      isPending: false,
      isError: false,
      onRetry: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      onLoadMore: vi.fn(),
    });
    await user.click(screen.getByRole('button', { name: 'Ջնջել' }));
    expect(deleteMutateAsync).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Այո, ջնջել' }));
    await waitFor(() => expect(deleteMutateAsync).toHaveBeenCalledWith(3));
    expect(
      await screen.findByText('Հայտարարությունը ջնջվել է։'),
    ).toBeInTheDocument();
  });

  test('renders a Load More button when hasNextPage is true', () => {
    renderList({
      listings: [listingFixture()],
      isPending: false,
      isError: false,
      onRetry: vi.fn(),
      hasNextPage: true,
      isFetchingNextPage: false,
      onLoadMore: vi.fn(),
    });
    expect(
      screen.getByRole('button', { name: 'Բեռնել ավելին' }),
    ).toBeInTheDocument();
  });
});
