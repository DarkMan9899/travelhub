/**
 * Availability module DI container (BACKEND_ARCHITECTURE.md §17).
 * Constructs one Repository per owned table (`bookable_units`,
 * `availability_calendar`, `blackout_dates`), the two smaller Services
 * that own those tables directly (`BookableUnitService`,
 * `BlackoutService`), and `AvailabilityService`, which composes both
 * plus owns `availability_calendar` itself — mirroring
 * `BACKEND_ARCHITECTURE.md`'s Module Catalog #15 ("Public Services:
 * AvailabilityCheckService, BookableUnitService, BlackoutService").
 *
 * Takes `listingService` as an injected dependency (constructed by
 * `routes/v1.js` after the Listings container, same pattern as Auth
 * receiving Users' `userService`) rather than constructing its own
 * Listings repository — BACKEND_ARCHITECTURE.md §4's cross-module rule.
 */

import { MySqlBookableUnitRepository } from './repositories/mysqlBookableUnitRepository.js';
import { MySqlAvailabilityCalendarRepository } from './repositories/mysqlAvailabilityCalendarRepository.js';
import { MySqlBlackoutRepository } from './repositories/mysqlBlackoutRepository.js';
import { MySqlReservationHoldRepository } from './repositories/mysqlReservationHoldRepository.js';
import { BookableUnitService } from './services/bookableUnitService.js';
import { BlackoutService } from './services/blackoutService.js';
import { AvailabilityService } from './services/availabilityService.js';
import { createAvailabilityController } from './controllers/availabilityController.js';

export default function createAvailabilityContainer({
  listingService,
  permissionResolver,
}) {
  const bookableUnitRepository = new MySqlBookableUnitRepository();
  const availabilityCalendarRepository =
    new MySqlAvailabilityCalendarRepository();
  const blackoutRepository = new MySqlBlackoutRepository();
  // Sprint 10: reservation_holds — Availability keeps owning this table
  // too, same as its other three (see availabilityService.js's header).
  const reservationHoldRepository = new MySqlReservationHoldRepository();

  const bookableUnitService = new BookableUnitService({
    bookableUnitRepository,
  });
  const blackoutService = new BlackoutService({ blackoutRepository });
  const availabilityService = new AvailabilityService({
    availabilityCalendarRepository,
    reservationHoldRepository,
    bookableUnitService,
    blackoutService,
    listingService,
    permissionResolver,
  });
  const availabilityController =
    createAvailabilityController(availabilityService);

  return {
    bookableUnitRepository,
    availabilityCalendarRepository,
    blackoutRepository,
    reservationHoldRepository,
    bookableUnitService,
    blackoutService,
    availabilityService,
    availabilityController,
  };
}
