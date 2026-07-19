/**
 * Listings module DI container (BACKEND_ARCHITECTURE.md §17): constructs
 * this module's own Repository + Service, wiring concrete infrastructure
 * to the core ports/services it depends on. Shared, cross-module
 * singletons (`auditLogger`, `permissionResolver`) are constructed once at
 * the true composition root (`src/app.js`) and passed in here, mirroring
 * `modules/users/module.container.js` exactly.
 */

import { MySqlListingRepository } from './repositories/mysqlListingRepository.js';
import { ListingService } from './services/listingService.js';
import { createListingController } from './controllers/listingController.js';
import { LocalStorageProvider } from '../../infrastructure/storage/localStorageProvider.js';

export default function createListingsContainer({
  auditLogger,
  permissionResolver,
}) {
  const listingRepository = new MySqlListingRepository();
  const storageProvider = new LocalStorageProvider();

  const listingService = new ListingService({
    listingRepository,
    storageProvider,
    auditLogger,
    permissionResolver,
  });
  const listingController = createListingController(listingService);

  return { listingRepository, listingService, listingController };
}
