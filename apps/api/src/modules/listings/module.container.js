/**
 * Listings module DI container (BACKEND_ARCHITECTURE.md §17): constructs
 * this module's own Repository + Service, wiring concrete infrastructure
 * to the core ports/services it depends on. Shared, cross-module
 * singletons (`auditLogger`, `permissionResolver`) are constructed once at
 * the true composition root (`src/app.js`) and passed in here, mirroring
 * `modules/users/module.container.js` exactly.
 */

import { MySqlListingRepository } from './repositories/mysqlListingRepository.js';
import { MySqlListingMetadataRepository } from './repositories/mysqlListingMetadataRepository.js';
import { ListingService } from './services/listingService.js';
import { ListingMetadataService } from './services/listingMetadataService.js';
import { createListingController } from './controllers/listingController.js';
import { LocalStorageProvider } from '../../infrastructure/storage/localStorageProvider.js';

export default function createListingsContainer({
  auditLogger,
  permissionResolver,
  eventBus,
}) {
  const listingRepository = new MySqlListingRepository();
  const listingMetadataRepository = new MySqlListingMetadataRepository();
  const storageProvider = new LocalStorageProvider();

  const listingService = new ListingService({
    listingRepository,
    listingMetadataRepository,
    storageProvider,
    auditLogger,
    permissionResolver,
    eventBus,
  });
  const listingMetadataService = new ListingMetadataService({
    listingMetadataRepository,
  });
  const listingController = createListingController(
    listingService,
    listingMetadataService,
  );

  return {
    listingRepository,
    listingMetadataRepository,
    listingService,
    listingMetadataService,
    listingController,
  };
}
