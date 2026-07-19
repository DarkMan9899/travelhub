/**
 * Users module DI container (BACKEND_ARCHITECTURE.md §17): constructs
 * this module's own Repository + Service, wiring concrete infrastructure
 * to the core ports/services it depends on. Shared, cross-module
 * singletons (`auditLogger`, `permissionResolver`) are constructed once
 * at the true composition root (`src/app.js`) and passed in here, never
 * re-constructed per module — a second `PermissionResolver` instance
 * would mean a second, redundant Redis-caching layer.
 */

import { MySqlUserRepository } from './repositories/mysqlUserRepository.js';
import { UserService } from './services/userService.js';
import { createUserController } from './controllers/userController.js';
import { LocalStorageProvider } from '../../infrastructure/storage/localStorageProvider.js';

export default function createUsersContainer({
  auditLogger,
  permissionResolver,
}) {
  const userRepository = new MySqlUserRepository();
  const storageProvider = new LocalStorageProvider();

  const userService = new UserService({
    userRepository,
    storageProvider,
    auditLogger,
    permissionResolver,
  });
  const userController = createUserController(userService);

  return { userRepository, userService, userController };
}
