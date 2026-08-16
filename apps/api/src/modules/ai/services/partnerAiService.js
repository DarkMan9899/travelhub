/**
 * PartnerAiService (Stage 15.5) — six content-generation tools for a
 * partner's own listing, wired into the Partner Listing Wizard/edit flow.
 * Every method grounds on the *real, current* fields of a listing the
 * caller genuinely owns (or has `listing.update` for) — never a second
 * Repository over `listings`' table, and never a fabricated fact. Output
 * is always generated content for the partner to review and apply
 * themselves; nothing here writes to a listing.
 *
 * Ownership: `listingService.getListing` already 404s an unpublished
 * listing the caller doesn't own — but a *published* listing is public
 * data there (by design, for the storefront read path), so this service
 * adds its own explicit owner-or-permission check afterward, the same
 * `isPartnerOwner`/`listing.update` rule `ListingService` itself uses
 * internally — a partner AI tool must never run against someone else's
 * listing just because it happens to be published.
 */

import {
  AuthenticationError,
  AuthorizationError,
  ValidationError,
} from '../../../errors/AppError.js';
import { isPartnerOwner } from '../../../infrastructure/database/repositories/partnerEmployeeRepository.js';
import {
  buildListingDescriptionPrompt,
  buildListingSeoPrompt,
  buildListingTitlePrompt,
  buildListingAmenitiesPrompt,
  buildListingTranslatePrompt,
  buildListingFaqsPrompt,
} from '../prompts/partnerListingContent.js';
import { FEATURE_CODES } from '../constants/featureCodes.js';

const LISTING_UPDATE_PERMISSION = 'listing.update';

export class PartnerAiService {
  #listingService;

  #searchService;

  #aiService;

  #permissionResolver;

  constructor({
    listingService,
    searchService,
    aiService,
    permissionResolver,
  }) {
    this.#listingService = listingService;
    this.#searchService = searchService;
    this.#aiService = aiService;
    this.#permissionResolver = permissionResolver;
  }

  async #resolveOwnedListingContext(principal, listingId) {
    if (!principal) throw new AuthenticationError();
    const listing = await this.#listingService.getListing(principal, listingId);
    const isOwner = await isPartnerOwner(principal.userId, listing.partnerId);
    if (!isOwner) {
      const hasPermission = await this.#permissionResolver.hasPermission(
        principal.roles,
        LISTING_UPDATE_PERMISSION,
      );
      if (!hasPermission) throw new AuthorizationError();
    }

    const categories = await this.#searchService.searchCategories();
    const categoryName =
      categories.find((category) => listing.categoryIds?.includes(category.id))
        ?.name ?? null;

    return {
      partnerId: listing.partnerId,
      title: listing.translations?.[0]?.title ?? null,
      description: listing.translations?.[0]?.description ?? null,
      category: categoryName,
      city: listing.location?.cityName ?? null,
      policies: {
        cancellation:
          listing.policyValues?.find(
            (value) => value.code === 'cancellation_policy',
          )?.value ?? null,
      },
    };
  }

  /**
   * `context` always carries `partnerId` (from `#resolveOwnedListingContext`,
   * possibly re-attached by a caller that builds a narrower prompt object —
   * see `translate`/`generateFaqs`) so every partner-tool call attributes
   * its `ai_usage_logs` row to the real owning partner — the Partner AI
   * Usage page (Phase 15 "AI Polish" sprint) has nothing to show otherwise.
   * `partnerId` is stripped out before building the prompt itself: it's
   * usage-attribution metadata, not grounding data the LLM needs to see.
   */
  async #generate(principal, featureCode, buildPrompt, context) {
    const { partnerId, ...promptContext } = context;
    const { system, user } = buildPrompt(promptContext);
    const { content } = await this.#aiService.complete({
      principal,
      featureCode,
      partnerId,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    });
    return { content };
  }

  async generateDescription(principal, listingId) {
    const context = await this.#resolveOwnedListingContext(
      principal,
      listingId,
    );
    return this.#generate(
      principal,
      FEATURE_CODES.LISTING_DESCRIPTION,
      buildListingDescriptionPrompt,
      context,
    );
  }

  async generateSeo(principal, listingId) {
    const context = await this.#resolveOwnedListingContext(
      principal,
      listingId,
    );
    return this.#generate(
      principal,
      FEATURE_CODES.LISTING_SEO,
      buildListingSeoPrompt,
      context,
    );
  }

  async generateTitle(principal, listingId, { keyFeature } = {}) {
    const context = await this.#resolveOwnedListingContext(
      principal,
      listingId,
    );
    return this.#generate(
      principal,
      FEATURE_CODES.LISTING_TITLE,
      buildListingTitlePrompt,
      { ...context, keyFeature: keyFeature ?? null },
    );
  }

  async generateAmenities(principal, listingId) {
    const context = await this.#resolveOwnedListingContext(
      principal,
      listingId,
    );
    return this.#generate(
      principal,
      FEATURE_CODES.LISTING_AMENITIES,
      buildListingAmenitiesPrompt,
      context,
    );
  }

  async translate(principal, listingId, { targetLanguageCode } = {}) {
    if (!principal) throw new AuthenticationError();
    if (!targetLanguageCode) {
      throw new ValidationError('A target language is required.', [
        { field: 'targetLanguageCode', issue: 'REQUIRED' },
      ]);
    }
    const context = await this.#resolveOwnedListingContext(
      principal,
      listingId,
    );
    return this.#generate(
      principal,
      FEATURE_CODES.LISTING_TRANSLATE,
      buildListingTranslatePrompt,
      {
        partnerId: context.partnerId,
        text: context.description ?? context.title,
        targetLanguageCode,
      },
    );
  }

  async generateFaqs(principal, listingId) {
    const context = await this.#resolveOwnedListingContext(
      principal,
      listingId,
    );
    return this.#generate(
      principal,
      FEATURE_CODES.LISTING_FAQS,
      buildListingFaqsPrompt,
      { partnerId: context.partnerId, policies: context.policies },
    );
  }
}

export default PartnerAiService;
