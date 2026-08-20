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
import { createStorageProvider } from '../../infrastructure/storage/createStorageProvider.js';

export default function createPartnersContainer({
  permissionResolver,
  auditLogger,
  eventBus,
} = {}) {
  const partnerRepository = new MySqlPartnerRepository();
  // P1.3 (Master Roadmap) — logo/cover upload, same self-contained
  // factory call as the listings module's own container.
  const storageProvider = createStorageProvider();
  const partnerService = new PartnerService({
    partnerRepository,
    permissionResolver,
    auditLogger,
    eventBus,
    storageProvider,
  });
  const partnerController = createPartnerController(partnerService);

  return { partnerRepository, partnerService, partnerController };
}
