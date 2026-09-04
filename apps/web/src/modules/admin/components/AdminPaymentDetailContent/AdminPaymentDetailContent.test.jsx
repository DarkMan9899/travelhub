import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ToastProvider from '../../../../providers/ToastProvider.jsx';
import AdminPaymentDetailContent from './AdminPaymentDetailContent.jsx';
import { useAuth } from '../../../../contexts/AuthContext.jsx';
import {
  usePaymentQuery,
  useCreateRefundMutation,
  usePaymentsConfigQuery,
} from '../../../payments/index.js';

vi.mock('../../../../contexts/AuthContext.jsx', () => ({ useAuth: vi.fn() }));
vi.mock('../../../payments/index.js', () => ({
  usePaymentQuery: vi.fn(),
  useCreateRefundMutation: vi.fn(),
  usePaymentsConfigQuery: vi.fn(),
  // eslint-disable-next-line react/prop-types -- trivial test double
  PaymentSummaryCard: ({ payment: { status } }) => (
    <div>PaymentSummaryCard {status}</div>
  ),
}));

const BASE_PAYMENT = {
  id: 3,
  payment_reference: 'PAY-20260101-ABCDEF23',
  status: 'SUCCEEDED',
  refundable_amount: '85000.00',
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/hy/admin/payments/3']}>
      <ToastProvider>
        <Routes>
          <Route
            path="/:locale/admin/payments/:id"
            element={<AdminPaymentDetailContent />}
          />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
  );
}

describe('AdminPaymentDetailContent (apps/web/src/modules/admin)', () => {
  let refundMutateAsync;

  beforeEach(() => {
    refundMutateAsync = vi.fn().mockResolvedValue({});
    useCreateRefundMutation.mockReturnValue({
      mutateAsync: refundMutateAsync,
      isPending: false,
    });
    useAuth.mockReturnValue({ permissions: ['payment.refund'] });
    usePaymentsConfigQuery.mockReturnValue({ data: { enabled: true } });
  });

  test('renders the payment summary once loaded', () => {
    usePaymentQuery.mockReturnValue({
      data: BASE_PAYMENT,
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
    renderPage();
    expect(
      screen.getByText('PaymentSummaryCard SUCCEEDED'),
    ).toBeInTheDocument();
  });

  test('shows the refund action for a refundable payment when permitted', () => {
    usePaymentQuery.mockReturnValue({
      data: BASE_PAYMENT,
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
    renderPage();
    expect(
      screen.getByRole('button', { name: 'Կատարել վերադարձ' }),
    ).toBeInTheDocument();
  });

  test('hides the refund action without the payment.refund permission', () => {
    useAuth.mockReturnValue({ permissions: [] });
    usePaymentQuery.mockReturnValue({
      data: BASE_PAYMENT,
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
    renderPage();
    expect(
      screen.queryByRole('button', { name: 'Կատարել վերադարձ' }),
    ).not.toBeInTheDocument();
  });

  test('hides the refund action for a non-refundable status', () => {
    usePaymentQuery.mockReturnValue({
      data: { ...BASE_PAYMENT, status: 'FAILED' },
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
    renderPage();
    expect(
      screen.queryByRole('button', { name: 'Կատարել վերադարձ' }),
    ).not.toBeInTheDocument();
  });

  test('issuing a refund opens the dialog, calls the mutation, and shows a success toast', async () => {
    usePaymentQuery.mockReturnValue({
      data: BASE_PAYMENT,
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Կատարել վերադարձ' }));
    const dialog = screen.getByRole('dialog');
    await user.click(
      within(dialog).getByRole('button', { name: 'Կատարել վերադարձ' }),
    );

    await waitFor(() =>
      expect(refundMutateAsync).toHaveBeenCalledWith({
        paymentId: 3,
        amount: '85000.00',
        reason: undefined,
      }),
    );
    expect(
      await screen.findByText('Վերադարձն իրականացվել է։'),
    ).toBeInTheDocument();
  });

  test('closing the dialog via Cancel does not call the mutation', async () => {
    usePaymentQuery.mockReturnValue({
      data: BASE_PAYMENT,
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Կատարել վերադարձ' }));
    await user.click(screen.getByRole('button', { name: 'Չեղարկել' }));

    expect(refundMutateAsync).not.toHaveBeenCalled();
    expect(screen.queryByText('Վերադարձի գումար')).not.toBeInTheDocument();
  });

  test('shows an error toast when the refund fails', async () => {
    useCreateRefundMutation.mockReturnValue({
      mutateAsync: vi.fn().mockRejectedValue(new Error('boom')),
      isPending: false,
    });
    usePaymentQuery.mockReturnValue({
      data: BASE_PAYMENT,
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Կատարել վերադարձ' }));
    const dialog = screen.getByRole('dialog');
    await user.click(
      within(dialog).getByRole('button', { name: 'Կատարել վերադարձ' }),
    );

    expect(
      await screen.findByText(
        'Չհաջողվեց իրականացնել այս վերադարձը։ Խնդրում ենք կրկին փորձել։',
      ),
    ).toBeInTheDocument();
  });

  test('renders a 404 empty state for a genuine not-found error', () => {
    usePaymentQuery.mockReturnValue({
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
    usePaymentQuery.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
      error: { status: 500 },
      refetch: vi.fn(),
    });
    renderPage();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  test('when payments are paused, a refundable payment shows an explanatory notice instead of a live refund button', () => {
    usePaymentsConfigQuery.mockReturnValue({ data: { enabled: false } });
    usePaymentQuery.mockReturnValue({
      data: BASE_PAYMENT,
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
    renderPage();

    expect(
      screen.queryByRole('button', { name: 'Կատարել վերադարձ' }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('Փոխհատուցումն անհասանելի է')).toBeInTheDocument();
    expect(screen.getByText('Վճարումները դադարեցված են')).toBeInTheDocument();
  });
});
