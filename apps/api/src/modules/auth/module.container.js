/**
 * Auth module DI container (BACKEND_ARCHITECTURE.md §17): constructs
 * this module's own Repositories + internal Services, wiring concrete
 * infrastructure to the ports/services it depends on. `userService`,
 * `auditLogger`, and `permissionResolver` are shared, cross-module
 * singletons constructed at the true composition root (`src/app.js` /
 * `src/routes/v1.js`) and passed in here, never re-constructed.
 */

import { MySqlRefreshTokenRepository } from './repositories/mysqlRefreshTokenRepository.js';
import { MySqlLoginHistoryRepository } from './repositories/mysqlLoginHistoryRepository.js';
import { LoginAttemptTracker } from './services/loginAttemptTracker.js';
import { AuthenticationService } from './services/authenticationService.js';
import { createAuthController } from './controllers/authController.js';

export default function createAuthContainer({
  userService,
  auditLogger,
  permissionResolver,
}) {
  const refreshTokenRepository = new MySqlRefreshTokenRepository();
  const loginHistoryRepository = new MySqlLoginHistoryRepository();
  const loginAttemptTracker = new LoginAttemptTracker();

  const authenticationService = new AuthenticationService({
    userService,
    refreshTokenRepository,
    loginHistoryRepository,
    loginAttemptTracker,
    permissionResolver,
    auditLogger,
  });
  const authController = createAuthController(authenticationService);

  return { authenticationService, authController };
}
