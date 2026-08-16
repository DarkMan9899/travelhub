/**
 * Featured-destinations placeholder data — a curated set of real Armenian
 * destinations (matching `home.hero.title`'s "Discover Armenia"), not
 * backed by any API this phase (no destinations endpoint exists yet).
 * Localized copy lives in translations under `home.destinations.items.*`
 * — this file holds only the structural, non-text shape, kept separate
 * from every presentational component that consumes it.
 */

import { destinationMotif } from '../../../assets/images/index.js';

const FEATURED_DESTINATIONS = [
  { id: 'yerevan', image: destinationMotif },
  { id: 'dilijan', image: destinationMotif },
  { id: 'tatev', image: destinationMotif },
  { id: 'sevan', image: destinationMotif },
  { id: 'gyumri', image: destinationMotif },
  { id: 'jermuk', image: destinationMotif },
];

export default FEATURED_DESTINATIONS;
