/**
 * `/api/v1` router aggregator.
 *
 * Implements BACKEND_ARCHITECTURE.md §49 (API Versioning): URL path
 * versioning, routing versioned by directory rather than runtime
 * feature-flagging — this file is that directory's entry point.
 *
 * Sprint 6: the first modules are wired in. Each module owns its own
 * `module.container.js` (constructs that module's Repositories/Services,
 * §17) and `module.routes.js` (route wiring only, §2) — this file's only
 * job is composing them together with the shared guards/services
 * constructed once in `src/app.js`'s composition root.
 */

import { Router } from 'express';
import createUsersContainer from '../modules/users/module.container.js';
import createUserRoutes from '../modules/users/module.routes.js';
import createAuthContainer from '../modules/auth/module.container.js';
import createAuthRoutes from '../modules/auth/module.routes.js';
import createListingsContainer from '../modules/listings/module.container.js';
import createListingRoutes from '../modules/listings/module.routes.js';
import createSearchContainer from '../modules/search/module.container.js';
import createSearchRoutes from '../modules/search/module.routes.js';
import createAvailabilityContainer from '../modules/availability/module.container.js';
import createAvailabilityRoutes from '../modules/availability/module.routes.js';
import createBookingHoldsContainer from '../modules/booking-holds/module.container.js';
import createBookingHoldRoutes from '../modules/booking-holds/module.routes.js';
import createBookingsContainer from '../modules/bookings/module.container.js';
import createBookingRoutes from '../modules/bookings/module.routes.js';

export default function createV1Router({
  guards,
  auditLogger,
  permissionResolver,
}) {
  const router = Router();

  const usersContainer = createUsersContainer({
    auditLogger,
    permissionResolver,
  });
  // Auth depends on Users' public Service interface, never its
  // Repository directly (BACKEND_ARCHITECTURE.md §4's cross-module rule).
  const authContainer = createAuthContainer({
    userService: usersContainer.userService,
    auditLogger,
    permissionResolver,
  });
  const listingsContainer = createListingsContainer({
    auditLogger,
    permissionResolver,
  });
  const searchContainer = createSearchContainer({ permissionResolver });
  // Availability depends on Listings' public Service interface, never its
  // Repository directly (BACKEND_ARCHITECTURE.md §4's cross-module rule).
  const availabilityContainer = createAvailabilityContainer({
    listingService: listingsContainer.listingService,
    permissionResolver,
  });
  // Sprint 10: Booking-Holds/Bookings depend on Availability's (and,
  // for Bookings, Listings') public Service interfaces only — never a
  // second Repository over bookable_units/availability_calendar/
  // reservation_holds/listings (BACKEND_ARCHITECTURE.md §4).
  const bookingHoldsContainer = createBookingHoldsContainer({
    availabilityService: availabilityContainer.availabilityService,
  });
  const bookingsContainer = createBookingsContainer({
    availabilityService: availabilityContainer.availabilityService,
    listingService: listingsContainer.listingService,
    permissionResolver,
  });

  router.use(
    '/auth',
    createAuthRoutes({ authController: authContainer.authController, guards }),
  );
  router.use(
    '/users',
    createUserRoutes({ userController: usersContainer.userController, guards }),
  );
  router.use(
    '/listings',
    createListingRoutes({
      listingController: listingsContainer.listingController,
      guards,
    }),
  );
  router.use(
    '/search',
    createSearchRoutes({ searchController: searchContainer.searchController }),
  );
  router.use(
    '/availability',
    createAvailabilityRoutes({
      availabilityController: availabilityContainer.availabilityController,
      guards,
    }),
  );
  router.use(
    '/booking-holds',
    createBookingHoldRoutes({
      bookingHoldController: bookingHoldsContainer.bookingHoldController,
      guards,
    }),
  );
  router.use(
    '/bookings',
    createBookingRoutes({
      bookingController: bookingsContainer.bookingController,
      guards,
    }),
  );

  return {
    router,
    // Sprint 10: server.js (the composition root's process-entry
    // counterpart) needs these two Service instances to register the
    // hold-expiry/pending-vendor-SLA scheduled jobs — app.js/tests never
    // read this, they only use `router`.
    availabilityService: availabilityContainer.availabilityService,
    bookingService: bookingsContainer.bookingService,
  };
}
