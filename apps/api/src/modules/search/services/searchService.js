/**
 * SearchService — public Service for the Search & Discovery module.
 *
 * Read-only: no mutation methods, so no `auditLogger` dependency (nothing
 * to audit). Reuses `isPartnerOwner` (Sprint 6,
 * `infrastructure/database/repositories/partnerEmployeeRepository.js`) and
 * the injected `PermissionResolver` — the exact same authorization
 * primitives `ListingService` uses — rather than re-deriving visibility
 * rules. Never duplicates listing business logic: this module only reads
 * and filters, it has no CRUD/ownership/status-transition concerns of its
 * own (BACKEND_ARCHITECTURE.md §4's cross-module rule doesn't apply to
 * shared crosscutting primitives like `isPartnerOwner`, only to another
 * module's Repository).
 */

import { isPartnerOwner } from '../../../infrastructure/database/repositories/partnerEmployeeRepository.js';
import { resolveSortOption } from '../../../core/domain/sortOptions.js';

const SUGGESTION_MIN_QUERY_LENGTH = 2;

export class SearchService {
  #searchRepository;

  #permissionResolver;

  constructor({ searchRepository, permissionResolver }) {
    this.#searchRepository = searchRepository;
    this.#permissionResolver = permissionResolver;
  }

  /**
   * Visibility rule (Sprint 8 plan): an owner of the filtered `partnerId`
   * (Sprint 6's "Host" mapping) or anyone holding `listing.moderate`
   * (Admin/Moderator) may see the `status` they asked for — including
   * drafts — with no filter meaning "every status," mirroring
   * `ListingService.listListings`. Everyone else is silently narrowed to
   * `PUBLISHED` only, the same "never leak via an error, just narrow"
   * philosophy as `ListingService.getListing`'s 404-masking.
   */
  async #resolveVisibility(principal, { partnerId, status }) {
    let elevated = false;
    if (principal && partnerId !== undefined) {
      elevated = await isPartnerOwner(principal.userId, partnerId);
    }
    if (!elevated && principal) {
      elevated = await this.#permissionResolver.hasPermission(
        principal.roles,
        'listing.moderate',
      );
    }
    if (elevated) {
      return status ? { statusCode: status } : {};
    }
    return { onlyPublished: true };
  }

  async searchListings(principal, params = {}) {
    const {
      keyword,
      categoryId,
      listingType,
      cityId,
      countryId,
      partnerId,
      status,
      locale,
      sort: sortKey,
      cursor,
      limit,
    } = params;

    const [visibility, { localeId, defaultLocaleId }] = await Promise.all([
      this.#resolveVisibility(principal, { partnerId, status }),
      this.#searchRepository.resolveLocaleIds(locale),
    ]);
    const sort = resolveSortOption(sortKey, { hasKeyword: Boolean(keyword) });

    const filters = {
      keyword,
      categoryId,
      listingTypeCode: listingType,
      cityId,
      countryId,
      partnerId,
      localeId,
      defaultLocaleId,
      ...visibility,
    };

    return this.#searchRepository.searchListings(filters, sort, {
      cursor,
      limit,
    });
  }

  async searchCategories(locale) {
    const { localeId, defaultLocaleId } =
      await this.#searchRepository.resolveLocaleIds(locale);
    return this.#searchRepository.searchCategories({
      localeId,
      defaultLocaleId,
    });
  }

  /**
   * Empty/very-short queries return no suggestions rather than a
   * validation error — graceful, typing-in-progress UX (and avoids a
   * wasteful `LIKE '%'`-style scan for a query too short to mean anything).
   */
  async suggest(query, locale) {
    if (!query || query.trim().length < SUGGESTION_MIN_QUERY_LENGTH) {
      return [];
    }
    const { localeId, defaultLocaleId } =
      await this.#searchRepository.resolveLocaleIds(locale);
    return this.#searchRepository.suggest(query.trim(), {
      localeId,
      defaultLocaleId,
    });
  }
}

export default SearchService;
