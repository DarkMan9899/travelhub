/**
 * Payments module dependency-injection container (Phase 16). Mirrors
 * every other module's `module.container.js` shape exactly — constructs
 * this module's Repositories/Services/Controllers and returns them as a
 * flat object for `routes/v1.js`'s composition root to wire into routes.
 *
 * Depends on `BookingService`'s public interface only (never a second
 * Repository over `bookings`) — same cross-module rule every other module
 * in this codebase already follows.
 */

import config from '../../config/index.js';
import { MySqlPaymentRepository } from './repositories/mysqlPaymentRepository.js';
import { MySqlRefundRepository } from './repositories/mysqlRefundRepository.js';
import { MySqlPaymentProviderEventRepository } from './repositories/mysqlPaymentProviderEventRepository.js';
import { MySqlLedgerRepository } from './repositories/mysqlLedgerRepository.js';
import { PaymentProviderRegistry } from './providers/paymentProviderRegistry.js';
import { PaymentService } from './services/paymentService.js';
import { LedgerService } from './services/ledgerService.js';
import {
  createPaymentController,
  createLedgerController,
} from './controllers/paymentController.js';
import { enqueueLocalSettlement } from './jobs/localProviderSettlementQueue.js';

export default function createPaymentsContainer({
  bookingService,
  permissionResolver,
  auditLogger,
  eventBus,
}) {
  const paymentRepository = new MySqlPaymentRepository();
  const refundRepository = new MySqlRefundRepository();
  const providerEventRepository = new MySqlPaymentProviderEventRepository();
  const ledgerRepository = new MySqlLedgerRepository();
  const providerRegistry = new PaymentProviderRegistry({
    paymentsConfig: config.payments,
  });

  const paymentService = new PaymentService({
    paymentRepository,
    refundRepository,
    providerEventRepository,
    ledgerRepository,
    providerRegistry,
    bookingService,
    permissionResolver,
    auditLogger,
    eventBus,
    settlementScheduler: enqueueLocalSettlement,
  });
  const ledgerService = new LedgerService({
    ledgerRepository,
    permissionResolver,
  });

  const paymentController = createPaymentController(paymentService);
  const ledgerController = createLedgerController(ledgerService);

  return {
    paymentRepository,
    refundRepository,
    providerEventRepository,
    ledgerRepository,
    providerRegistry,
    paymentService,
    ledgerService,
    paymentController,
    ledgerController,
  };
}
