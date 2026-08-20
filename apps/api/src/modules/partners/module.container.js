/**
 * Partners module DI container (BACKEND_ARCHITECTURE.md §17).
 *
 * Phase 11 Admin Platform: now takes `permissionResolver`/`auditLogger`
 * (constructed once at the true composition root, `src/app.js`) — the
 * module's first mutations (see `partnerService.js`) need them.
 *
 * P1.4 (Master Roadmap): also takes `userService` — depends on Users'
 * public Service interface, never its Repository directly
 * (BACKEND_ARCHITECTURE.md §4's cross-module rule), the same way
 * `authContainer`/`notificationsContainer` already do — needed to
 * resolve the ACCEPTING user's email when they claim an invitation
 * (`partnerStaffService.js#acceptInvitation`).
 */

import { MySqlPartnerRepository } from './repositories/mysqlPartnerRepository.js';
import { MySqlPartnerStaffRepository } from './repositories/mysqlPartnerStaffRepository.js';
import { PartnerService } from './services/partnerService.js';
import { PartnerStaffService } from './services/partnerStaffService.js';
import { createPartnerController } from './controllers/partnerController.js';
import { createPartnerStaffController } from './controllers/partnerStaffController.js';
import { createStorageProvider } from '../../infrastructure/storage/createStorageProvider.js';
import { createEmailAdapter } from '../notifications/module.container.js';

export default function createPartnersContainer({
  permissionResolver,
  auditLogger,
  eventBus,
  userService,
} = {}) {
  const partnerRepository = new MySqlPartnerRepository();
  const staffRepository = new MySqlPartnerStaffRepository();
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
  const partnerStaffService = new PartnerStaffService({
    staffRepository,
    partnerRepository,
    userService,
    auditLogger,
    eventBus,
    // Same provider-selection factory the notifications module's own
    // container uses — a staff-invitation email goes out directly (no
    // `recipientUserId` exists yet), never through the notification
    // event pipeline.
    emailAdapter: createEmailAdapter(),
  });
  const partnerController = createPartnerController(partnerService);
  const partnerStaffController =
    createPartnerStaffController(partnerStaffService);

  return {
    partnerRepository,
    partnerService,
    partnerController,
    staffRepository,
    partnerStaffService,
    partnerStaffController,
  };
}
