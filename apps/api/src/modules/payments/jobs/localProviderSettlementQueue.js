/**
 * Local Payment Provider settlement queue — Phase 16.
 *
 * `LocalPaymentProvider`'s `PROCESSING` simulation scenario needs
 * something to eventually resolve it (a real async provider would send a
 * webhook a few seconds/minutes later) — this is that "later," modeled as
 * a genuine delayed BullMQ job rather than a fake instant resolution, so
 * the app's real async/webhook code path (`PaymentService#handleProvider
 * Webhook`) is exercised even for the zero-dependency local provider.
 *
 * Mirrors `modules/booking-holds/jobs/holdExpirySweep.js`'s exact
 * `Queue`/`Worker` split: `enqueueLocalSettlement` is the plain producer
 * function, called by `PaymentService` as its `settlementScheduler`
 * constructor dependency; `registerLocalProviderSettlementWorker` is only
 * ever called from `server.js` (never `app.js`/tests), so no Redis-backed
 * worker runs during the supertest-driven integration suite.
 */

import { Queue, Worker } from 'bullmq';
import { createQueueConnection } from '../../../infrastructure/queue/connection.js';
import { getModuleLogger } from '../../../logging/logger.js';
import { createErrorTracker } from '../../../infrastructure/observability/createErrorTracker.js';

const QUEUE_NAME = 'payments.local-provider-settlement';
const SETTLEMENT_DELAY_MS = 4_000;

const log = getModuleLogger('payments:local-settlement');
const errorTracker = createErrorTracker();

let queue;

/** Lazily creates the producer-side Queue — safe to call from a request-handling path (unlike the Worker, which only ever runs in `server.js`). */
function getQueue() {
  if (!queue) {
    queue = new Queue(QUEUE_NAME, { connection: createQueueConnection() });
  }
  return queue;
}

/** @param {number} paymentId */
export function enqueueLocalSettlement(paymentId) {
  return getQueue().add(
    'settle',
    { paymentId },
    { delay: SETTLEMENT_DELAY_MS, jobId: `settle-${paymentId}` },
  );
}

/**
 * @param {object} deps
 * @param {import('../services/paymentService.js').PaymentService} deps.paymentService
 * @returns {{queue: Queue, worker: Worker}}
 */
export function registerLocalProviderSettlementWorker({ paymentService }) {
  const connection = createQueueConnection();
  const workerQueue = new Queue(QUEUE_NAME, { connection });

  const worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      const { paymentId } = job.data;
      const payment = await paymentService.getPaymentSystemInternal(paymentId);
      if (!payment || payment.statusCode !== 'PROCESSING') return; // already resolved — idempotent no-op
      await paymentService.handleProviderWebhook('local', {
        rawBody: JSON.stringify({ paymentId }),
        signatureHeader: null,
        parsedEvent: {
          id: `local_evt_settle_${paymentId}`,
          type: 'local.payment.succeeded',
          providerPaymentId: payment.providerPaymentId,
          status: 'SUCCEEDED',
        },
      });
    },
    { connection },
  );
  worker.on('failed', (job, err) => {
    log.error({ err, jobId: job?.id }, 'Local provider settlement job failed');
    errorTracker.captureException(err, { jobName: QUEUE_NAME, jobId: job?.id });
  });

  return { queue: workerQueue, worker };
}

export default registerLocalProviderSettlementWorker;
