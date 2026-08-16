/**
 * Popular-experiences placeholder data — no experiences API exists this
 * phase. Localized copy (name/location) lives in translations under
 * `home.experiences.items.*`; `categoryType` reuses the real
 * `listings.type` enum so the badge/link stay consistent with Categories
 * rather than inventing a second taxonomy.
 */

import { experienceMotif } from '../../../assets/images/index.js';

const POPULAR_EXPERIENCES = [
  {
    id: 'dilijan-hiking',
    image: experienceMotif,
    categoryType: 'TOUR',
    durationHours: 4,
    rating: 4.8,
    reviewCount: 132,
    price: { amount: 35, currencyCode: 'USD' },
  },
  {
    id: 'yerevan-food-walk',
    image: experienceMotif,
    categoryType: 'TOUR',
    durationHours: 3,
    rating: 4.9,
    reviewCount: 214,
    price: { amount: 28, currencyCode: 'USD' },
  },
  {
    id: 'sevan-boat-trip',
    image: experienceMotif,
    categoryType: 'TOUR',
    durationHours: 2,
    rating: 4.6,
    reviewCount: 98,
    price: { amount: 22, currencyCode: 'USD' },
  },
  {
    id: 'tatev-tramway',
    image: experienceMotif,
    categoryType: 'ATTRACTION',
    durationHours: 5,
    rating: 4.9,
    reviewCount: 301,
    price: { amount: 18, currencyCode: 'USD' },
  },
  {
    id: 'gyumri-walking-tour',
    image: experienceMotif,
    categoryType: 'TOUR',
    durationHours: 3,
    rating: 4.7,
    reviewCount: 76,
    price: { amount: 20, currencyCode: 'USD' },
  },
  {
    id: 'jermuk-spa-day',
    image: experienceMotif,
    categoryType: 'ATTRACTION',
    durationHours: 6,
    rating: 4.8,
    reviewCount: 145,
    price: { amount: 45, currencyCode: 'USD' },
  },
];

export default POPULAR_EXPERIENCES;
