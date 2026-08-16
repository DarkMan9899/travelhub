/**
 * Partners module DI container (BACKEND_ARCHITECTURE.md §17).
 *
 * Phase 11 Admin Platform: now takes `permissionResolver`/`auditLogger`
 * (constructed once at the true composition root, `src/app.js`) — the
 * module's first mutations (see `partnerService.js`) need them.
 */

import { MySqlPartnerRepository } from './repositories/mysqlPartnerRepository.js';
import { PartnerService } from './services/partnerService.js';
import { createPartnerController } from './controllers/partnerController.js';

export default function createPartnersContainer({
  permissionResolver,
  auditLogger,
  eventBus,
} = {}) {
  const partnerRepository = new MySqlPartnerRepository();
  const partnerService = new PartnerService({
    partnerRepository,
    permissionResolver,
    auditLogger,
    eventBus,
  });
  const partnerController = createPartnerController(partnerService);

  return { partnerRepository, partnerService, partnerController };
}
