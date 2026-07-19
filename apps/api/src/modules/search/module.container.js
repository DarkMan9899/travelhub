/**
 * Search module DI container (BACKEND_ARCHITECTURE.md §17), mirroring
 * `modules/listings/module.container.js`. Read-only module — no
 * `auditLogger`/`storageProvider` dependency, since there is nothing to
 * mutate or upload here.
 */

import { MySqlSearchRepository } from './repositories/mysqlSearchRepository.js';
import { SearchService } from './services/searchService.js';
import { createSearchController } from './controllers/searchController.js';

export default function createSearchContainer({ permissionResolver }) {
  const searchRepository = new MySqlSearchRepository();

  const searchService = new SearchService({
    searchRepository,
    permissionResolver,
  });
  const searchController = createSearchController(searchService);

  return { searchRepository, searchService, searchController };
}
