/**
 * Admin module DI container (BACKEND_ARCHITECTURE.md §17).
 *
 * Stage 11.5 adds a second, independent repository/service/controller
 * triplet for Marketplace Configuration — kept separate from
 * `AdminService`/`MySqlAdminRepository` (dashboard aggregation) since
 * they're unrelated concerns that happen to share this module only
 * because neither has a pre-existing owning module (see
 * `mysqlMarketplaceConfigRepository.js`'s header comment).
 *
 * Stage 11.7 adds a third, independent triplet for Audit Logs. The
 * repository is `MySqlAuditLogRepository` — the same class `app.js`
 * wraps in `AuditLogger` for writes — but this container builds its own
 * instance (it's stateless, pool-backed) rather than threading the
 * write-side singleton through, matching how every other repository here
 * is instantiated fresh per container.
 *
 * Stage 11.8 adds a fourth pair for System Health — service + controller
 * only, no repository (see `systemHealthService.js`'s header comment for
 * why: it probes live infra, not a table).
 */

import { MySqlAdminRepository } from './repositories/mysqlAdminRepository.js';
import { AdminService } from './services/adminService.js';
import { createAdminController } from './controllers/adminController.js';
import { MySqlMarketplaceConfigRepository } from './repositories/mysqlMarketplaceConfigRepository.js';
import { MarketplaceConfigService } from './services/marketplaceConfigService.js';
import { createMarketplaceConfigController } from './controllers/marketplaceConfigController.js';
import { MySqlAuditLogRepository } from '../../infrastructure/database/repositories/auditLogRepository.js';
import { AuditLogService } from './services/auditLogService.js';
import { createAuditLogController } from './controllers/auditLogController.js';
import { SystemHealthService } from './services/systemHealthService.js';
import { createSystemHealthController } from './controllers/systemHealthController.js';
import { MySqlSettingsRepository } from './repositories/mysqlSettingsRepository.js';
import { SettingsService } from './services/settingsService.js';
import { createSettingsController } from './controllers/settingsController.js';

export default function createAdminContainer({
  permissionResolver,
  auditLogger,
} = {}) {
  const adminRepository = new MySqlAdminRepository();
  const adminService = new AdminService({ adminRepository });
  const adminController = createAdminController(adminService);

  const marketplaceConfigRepository = new MySqlMarketplaceConfigRepository();
  const marketplaceConfigService = new MarketplaceConfigService({
    repository: marketplaceConfigRepository,
    permissionResolver,
    auditLogger,
  });
  const marketplaceConfigController = createMarketplaceConfigController(
    marketplaceConfigService,
  );

  const auditLogRepository = new MySqlAuditLogRepository();
  const auditLogService = new AuditLogService({
    repository: auditLogRepository,
    permissionResolver,
  });
  const auditLogController = createAuditLogController(auditLogService);

  const systemHealthService = new SystemHealthService();
  const systemHealthController =
    createSystemHealthController(systemHealthService);

  const settingsRepository = new MySqlSettingsRepository();
  const settingsService = new SettingsService({
    repository: settingsRepository,
    permissionResolver,
    auditLogger,
  });
  const settingsController = createSettingsController(settingsService);

  return {
    adminRepository,
    adminService,
    adminController,
    marketplaceConfigRepository,
    marketplaceConfigService,
    marketplaceConfigController,
    auditLogRepository,
    auditLogService,
    auditLogController,
    systemHealthService,
    systemHealthController,
    settingsRepository,
    settingsService,
    settingsController,
  };
}
