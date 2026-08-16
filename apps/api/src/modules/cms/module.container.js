/**
 * CMS module DI container (BACKEND_ARCHITECTURE.md §17).
 */

import { MySqlCmsRepository } from './repositories/mysqlCmsRepository.js';
import { CmsService } from './services/cmsService.js';
import { createCmsController } from './controllers/cmsController.js';

export default function createCmsContainer({
  permissionResolver,
  auditLogger,
} = {}) {
  const cmsRepository = new MySqlCmsRepository();
  const cmsService = new CmsService({
    repository: cmsRepository,
    permissionResolver,
    auditLogger,
  });
  const cmsController = createCmsController(cmsService);

  return { cmsRepository, cmsService, cmsController };
}
