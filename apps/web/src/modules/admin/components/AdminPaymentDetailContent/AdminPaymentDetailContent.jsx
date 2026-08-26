/**
 * AdminPaymentDetailContent — `/:locale/admin/payments/:id` (Phase 16
 * spec §22). Full payment detail (breakdown/status/attempts/
 * transactions/refunds) via the shared `PaymentSummaryCard`, plus a
 * permission-gated "Issue Refund" action — mirrors
 * `AdminBookingDetailContent`'s exact `permissions.includes(...)` gating
 * pattern and `AdminListingModerationPageContent`'s Modal-with-a-field
 * dialog shape (amount + optional reason, since a refund is never a
 * plain yes/no `useConfirm()` case).
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import { Section, Stack, Inline } from '@desavii/ui/components/layout';
import {
  Skeleton,
  ErrorState,
  EmptyState,
  Modal,
} from '@desavii/ui/components/feedback-overlays';
import { Button } from '@desavii/ui/components/primitives';
import { Input, Textarea } from '@desavii/ui/components/form-controls';
import PageHeader from '../../../../components/PageHeader/PageHeader.jsx';
import { useAuth } from '../../../../contexts/AuthContext.jsx';
import { useToast } from '../../../../contexts/ToastContext.jsx';
import {
  usePaymentQuery,
  useCreateRefundMutation,
  PaymentSummaryCard,
} from '../../../payments/index.js';

const REFUNDABLE_STATUSES = ['SUCCEEDED', 'PARTIALLY_REFUNDED'];

export default function AdminPaymentDetailContent() {
  const { t } = useTranslation();
  const { locale, id } = useParams();
  const navigate = useNavigate();
  const { permissions } = useAuth();
  const { showToast } = useToast();
  const paymentId = Number(id);

  const {
    data: payment,
    isPending,
    isError,
    error,
    refetch,
  } = usePaymentQuery(paymentId);
  const createRefundMutation = useCreateRefundMutation();

  const [isRefundDialogOpen, setRefundDialogOpen] = useState(false);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');

  const canRefund = permissions.includes('payment.refund');

  if (isPending) {
    return (
      <Section spacing="default" aria-busy="true">
        <Skeleton variant="text" width="40%" height={32} />
        <Skeleton variant="rect" height={200} />
      </Section>
    );
  }

  if (isError) {
    if (error.status === 404) {
      return (
        <EmptyState
          title={t('errors.notFound.title')}
          description={t('errors.notFound.description')}
          actionLabel={t('errors.notFound.action')}
          onAction={() => navigate(`/${locale}/admin/payments`)}
        />
      );
    }
    return (
      <Section>
        <ErrorState
          title={t('admin.payments.detail.error.title')}
          retryLabel={t('admin.payments.detail.error.retry')}
          onRetry={refetch}
        />
      </Section>
    );
  }

  const showRefundAction =
    canRefund && REFUNDABLE_STATUSES.includes(payment.status);

  function openRefundDialog() {
    setRefundAmount(payment.refundable_amount);
    setRefundReason('');
    setRefundDialogOpen(true);
  }

  function closeRefundDialog() {
    setRefundDialogOpen(false);
  }

  async function handleConfirmRefund() {
    try {
      await createRefundMutation.mutateAsync({
        paymentId: payment.id,
        amount: refundAmount,
        reason: refundReason || undefined,
      });
      showToast(t('admin.payments.detail.refundSuccess'), {
        variant: 'success',
      });
      closeRefundDialog();
    } catch {
      showToast(t('admin.payments.detail.refundError'), { variant: 'danger' });
    }
  }

  return (
    <Section spacing="default">
      <PageHeader
        title={t('admin.payments.detail.heading', {
          reference: payment.payment_reference,
        })}
        breadcrumbs={[
          { label: t('nav.home'), href: `/${locale}` },
          { label: t('admin.nav.dashboard'), href: `/${locale}/admin` },
          {
            label: t('admin.payments.heading'),
            href: `/${locale}/admin/payments`,
          },
          {
            label: payment.payment_reference,
            href: `/${locale}/admin/payments/${payment.id}`,
          },
        ]}
      />

      <Stack gap="4">
        <PaymentSummaryCard payment={payment} />

        {showRefundAction && (
          <Inline gap="3">
            <Button variant="destructive" onClick={() => openRefundDialog()}>
              {t('admin.payments.detail.refundAction')}
            </Button>
          </Inline>
        )}
      </Stack>

      {isRefundDialogOpen && (
        <Modal
          isOpen
          onClose={() => closeRefundDialog()}
          title={t('admin.payments.detail.refundDialogTitle')}
          size="sm"
          footer={
            <Inline gap="3" justify="flex-end">
              <Button variant="ghost" onClick={() => closeRefundDialog()}>
                {t('common.cancel')}
              </Button>
              <Button
                variant="destructive"
                onClick={() => handleConfirmRefund()}
                loading={createRefundMutation.isPending}
              >
                {t('admin.payments.detail.refundConfirmAction')}
              </Button>
            </Inline>
          }
        >
          <Stack gap="3">
            <span>{t('admin.payments.detail.refundDialogDescription')}</span>
            <Input
              type="number"
              label={t('admin.payments.detail.refundAmountLabel')}
              value={refundAmount}
              onChange={(event) => setRefundAmount(event.target.value)}
              min="0.01"
              max={payment.refundable_amount}
              step="0.01"
            />
            <Textarea
              label={t('admin.payments.detail.refundReasonLabel')}
              placeholder={t('admin.payments.detail.refundReasonPlaceholder')}
              value={refundReason}
              onChange={(event) => setRefundReason(event.target.value)}
              rows={3}
            />
          </Stack>
        </Modal>
      )}
    </Section>
  );
}
