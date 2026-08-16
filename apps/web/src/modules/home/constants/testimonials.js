/**
 * Testimonials placeholder data — realistic but not real customer
 * reviews (no reviews API is consumed here; `API_SPECIFICATION.md` §53's
 * favorites/review resources aren't this section's concern). Only the
 * id/rating structure lives here; quote/name/role copy lives in
 * translations under `home.testimonials.items.*`, kept out of this file
 * like every other placeholder dataset in this module so it's trivial to
 * swap for real reviews later.
 */

const TESTIMONIALS = [
  { id: 'testimonial-1', rating: 5 },
  { id: 'testimonial-2', rating: 5 },
  { id: 'testimonial-3', rating: 4 },
];

export default TESTIMONIALS;
