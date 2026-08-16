/**
 * Partner AI content-generation prompts (Stage 15.5). One file for all
 * six listing-content generators — they share the same concern (write
 * marketing/SEO/FAQ copy for a partner's own listing draft, grounded
 * only in that listing's real fields) closely enough that six near-
 * identical single-function files would be pure ceremony (KISS/DRY,
 * CLAUDE.md).
 *
 * Every builder here is a pure function — no hardcoded prompt text lives
 * in `partnerAiService.js` or a React component. Output is always
 * generated *content for the partner to review and apply themselves* —
 * this module (and the service that calls it) never writes to a
 * listing directly.
 */

import { buildSystemPrompt, buildUserPrompt } from './promptGrounding.js';
import { FEATURE_CODES } from '../constants/featureCodes.js';

function prompt(featureCode, roleInstructions, instructionText, context) {
  return {
    system: buildSystemPrompt(featureCode, roleInstructions),
    user: buildUserPrompt(instructionText, context),
  };
}

export function buildListingDescriptionPrompt({ title, category, city }) {
  return prompt(
    FEATURE_CODES.LISTING_DESCRIPTION,
    'You write compelling, honest listing descriptions for a travel ' +
      'marketplace partner. Use only the facts supplied below.',
    'Write a short listing description.',
    { title, category, city },
  );
}

export function buildListingSeoPrompt({ title, city, category }) {
  return prompt(
    FEATURE_CODES.LISTING_SEO,
    'You write SEO meta titles and descriptions for a travel marketplace ' +
      'listing. Use only the facts supplied below.',
    'Write an SEO meta title and description.',
    { title, city, category },
  );
}

export function buildListingTitlePrompt({ category, city, keyFeature }) {
  return prompt(
    FEATURE_CODES.LISTING_TITLE,
    'You write short, clear listing titles for a travel marketplace. Use ' +
      'only the facts supplied below.',
    'Suggest a listing title.',
    { category, city, keyFeature },
  );
}

export function buildListingAmenitiesPrompt({ category }) {
  return prompt(
    FEATURE_CODES.LISTING_AMENITIES,
    'You suggest common amenities for a travel marketplace listing based ' +
      'on its category. Suggest only plausible amenities for that category.',
    'Suggest amenities for this listing.',
    { category },
  );
}

export function buildListingTranslatePrompt({ text, targetLanguageCode }) {
  return prompt(
    FEATURE_CODES.LISTING_TRANSLATE,
    'You translate travel marketplace listing text. Translate only the ' +
      'text supplied below — never add facts not present in it.',
    'Translate this text.',
    { text, targetLanguageCode },
  );
}

export function buildListingFaqsPrompt({ policies, amenities }) {
  return prompt(
    FEATURE_CODES.LISTING_FAQS,
    'You write a short FAQ list for a travel marketplace listing, using ' +
      'only the policy/amenity facts supplied below.',
    'Write a short FAQ list for this listing.',
    { policies, amenities },
  );
}
