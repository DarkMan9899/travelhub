import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ToastProvider from '../../../../providers/ToastProvider.jsx';
import ConfirmProvider from '../../../../providers/ConfirmProvider.jsx';
import PartnerListingsPageContent from './PartnerListingsPageContent.jsx';
import { usePartnerContext } from '../../../../contexts/PartnerContext.jsx';
import { useMyListingsQuery } from '../../../listings/index.js';

vi.mock('../../../../contexts/PartnerContext.jsx', () => ({
  usePartnerContext: vi.fn(),
}));

vi.mock('../../../listings/index.js', async () => {
  const actual = await vi.importActual('../../../listings/index.js');
  return {
    ...actual,
    useMyListingsQuery: vi.fn(),
    usePublishListingMutation: () => ({
      mutateAsync: vi.fn(),
      isPending: false,
      variables: undefined,
    }),
    useUnpublishListingMutation: () => ({
      mutateAsync: vi.fn(),
      isPending: false,
      variables: undefined,
    }),
    useArchiveListingMutation: () => ({
      mutateAsync: vi.fn(),
      isPending: false,
      variables: undefined,
    }),
    useDeleteListingMutation: () => ({
      mutateAsync: vi.fn(),
      isPending: false,
      variables: undefined,
    }),
  };
});

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/hy/partner/listings']}>
      <ToastProvider>
        <ConfirmProvider>
          <Routes>
            <Route
              path="/:locale/partner/listings"
              element={<PartnerListingsPageContent />}
            />
          </Routes>
        </ConfirmProvider>
      </ToastProvider>
    </MemoryRouter>,
  );
}

describe('PartnerListingsPageContent (apps/web/src/modules/partner)', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    usePartnerContext.mockReturnValue({ activePartnerId: 3 });
    useMyListingsQuery.mockReturnValue({
      data: { pages: [{ results: [] }] },
      isPending: false,
      isError: false,
      refetch: vi.fn(),
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
    });
  });

  test('renders the heading and requests the active partner id with no filters by default', () => {
    renderPage();
    expect(
      screen.getByRole('heading', { name: 'Իմ հայտարարությունները' }),
    ).toBeInTheDocument();
    expect(useMyListingsQuery).toHaveBeenCalledWith(
      expect.objectContaining({ partnerId: 3, status: '', keyword: '' }),
    );
  });

  test('debounces the keyword filter into the query', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPage();

    await user.type(
      screen.getByLabelText('Փնտրել ձեր հայտարարությունների մեջ'),
      'villa',
    );
    act(() => {
      vi.advanceTimersByTime(400);
    });

    expect(useMyListingsQuery).toHaveBeenLastCalledWith(
      expect.objectContaining({ keyword: 'villa' }),
    );
    vi.useRealTimers();
  });

  test('navigates to the create-listing wizard from the header action', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(
      screen.getByRole('button', { name: 'Ստեղծել հայտարարություն' }),
    );
    expect(mockNavigate).toHaveBeenCalledWith('/hy/partner/listings/new');
  });
});
