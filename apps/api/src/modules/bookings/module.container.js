/**
 * Bookings module DI container (BACKEND_ARCHITECTURE.md §17).
 *
 * Takes `availabilityService` and `listingService` as injected
 * dependencies (constructed by `routes/v1.js` after their respective
 * containers) — never a second Repository over `bookable_units`/
 * `availability_calendar`/`reservation_holds`/`listings`, the same
 * cross-module rule every other module in this codebase already follows.
 */

import { MySqlBookingRepository } from './repositories/mysqlBookingRepository.js';
import { BookingService } from './services/bookingService.js';
import { createBookingController } from './controllers/bookingController.js';

export default function createBookingsContainer({
  availabilityService,
  listingService,
  permissionResolver,
}) {
  const bookingRepository = new MySqlBookingRepository();
  const bookingService = new BookingService({
    bookingRepository,
    availabilityService,
    listingService,
    permissionResolver,
  });
  const bookingController = createBookingController(bookingService);

  return {
    bookingRepository,
    bookingService,
    bookingController,
  };
}
