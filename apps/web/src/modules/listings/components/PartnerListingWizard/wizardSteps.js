/**
 * The fixed step order `PartnerListingWizard` walks a partner through
 * (Phase 5 spec's suggested structure, extended by Phase 18.10's
 * `content` step for the rich-content editors). `labelKey` resolves through
 * `partner.listingWizard.steps.*` — the step SEQUENCE is the one thing
 * about this wizard that genuinely is hardcoded (every category walks
 * the same steps in the same order); everything rendered *within* a step
 * (attributes, amenities, pricing models, policies) is fully
 * metadata-driven, never this list.
 */

export const WIZARD_STEPS = [
  { id: 'category', labelKey: 'partner.listingWizard.steps.category' },
  { id: 'basicInfo', labelKey: 'partner.listingWizard.steps.basicInfo' },
  { id: 'location', labelKey: 'partner.listingWizard.steps.location' },
  { id: 'attributes', labelKey: 'partner.listingWizard.steps.attributes' },
  { id: 'amenities', labelKey: 'partner.listingWizard.steps.amenities' },
  { id: 'media', labelKey: 'partner.listingWizard.steps.media' },
  { id: 'pricing', labelKey: 'partner.listingWizard.steps.pricing' },
  { id: 'availability', labelKey: 'partner.listingWizard.steps.availability' },
  { id: 'policies', labelKey: 'partner.listingWizard.steps.policies' },
  { id: 'content', labelKey: 'partner.listingWizard.steps.content' },
  { id: 'review', labelKey: 'partner.listingWizard.steps.review' },
];

// The wizard creates the real listing on this step's submit (Basic
// Information) — see `useListingWizardState.js`'s file header for why.
export const LISTING_CREATION_STEP_ID = 'basicInfo';

export default WIZARD_STEPS;
