/**
 * ListingService — public Service for the Listings module.
 *
 * Implements BACKEND_ARCHITECTURE.md §6/§13 and the Listings Module
 * Catalog entry (#7): owns all `listings`-table business logic, including
 * the "Owner or `{permission}`" authorization pattern (API_SPECIFICATION.md
 * §5/§38) and publish-readiness gating.
 *
 * Ownership ("Host") is Sprint 6's `isPartnerOwner` check against the
 * listing's `partner_id`, reused unmodified from
 * `infrastructure/database/repositories/partnerEmployeeRepository.js` — the
 * same file `requireHost` is built on. This mirrors `UserService`'s
 * `#assertOwnerOrPermission` pattern exactly, except ownership is
 * partner-based rather than a direct user-id match.
 *
 * Known, documented scope limits for this sprint (see the Sprint 7 plan):
 * - No `capacity`/`base_price` fields — deferred to future per-type modules.
 * - Publish-readiness does not check `bookable_unit` existence — the
 *   Availability module doesn't exist yet.
 * - `partner_id` is supplied explicitly by the caller and authorized via
 *   `isPartnerOwner`, since no Partners module exists yet to resolve "the
 *   caller's partner" from the token alone.
 */

import {
  AuthenticationError,
  AuthorizationError,
  ConflictError,
  ValidationError,
  NotFoundError,
} from '../../../errors/AppError.js';
import { isPartnerOwner } from '../../../infrastructure/database/repositories/partnerEmployeeRepository.js';
import { withTransaction } from '../../../infrastructure/database/transaction.js';
import { slugify } from '../../../core/domain/slugify.js';
import { isValidListingStatusTransition } from '../../../core/domain/listingStatusTransitions.js';
import {
  isAllowedMimeType,
  isWithinSizeLimit,
  classifyMimeType,
} from '../../media/validators/mediaConstraints.js';

export class ListingService {
  #listingRepository;

  #storageProvider;

  #auditLogger;

  #permissionResolver;

  constructor({
    listingRepository,
    storageProvider,
    auditLogger,
    permissionResolver,
  }) {
    this.#listingRepository = listingRepository;
    this.#storageProvider = storageProvider;
    this.#auditLogger = auditLogger;
    this.#permissionResolver = permissionResolver;
  }

  async #isOwnerOrHasPermission(principal, partnerId, permissionKey) {
    if (!principal) return false;
    const isOwner = await isPartnerOwner(principal.userId, partnerId);
    if (isOwner) return true;
    return this.#permissionResolver.hasPermission(
      principal.roles,
      permissionKey,
    );
  }

  /** "Owner or `{permissionKey}`" (API_SPECIFICATION.md §5/§38). */
  async #assertOwnerOrPermission(principal, partnerId, permissionKey) {
    if (!principal) throw new AuthenticationError();
    const allowed = await this.#isOwnerOrHasPermission(
      principal,
      partnerId,
      permissionKey,
    );
    if (!allowed) throw new AuthorizationError();
  }

  async #assertUniqueSlug(slug, excludeId = null) {
    const exists = await this.#listingRepository.slugExists(slug, {
      excludeId,
    });
    if (exists) {
      throw new ConflictError(
        'This slug is already in use.',
        'SLUG_ALREADY_EXISTS',
      );
    }
  }

  async createListing(principal, input) {
    if (!principal) throw new AuthenticationError();

    const { exists, verificationStatusCode } =
      await this.#listingRepository.getPartnerVerification(input.partnerId);
    if (!exists) {
      throw new ValidationError(
        'This request references a record that does not exist.',
        [{ field: 'partnerId', issue: 'NOT_FOUND' }],
      );
    }
    if (verificationStatusCode !== 'APPROVED') {
      throw new AuthorizationError(
        'This partner is not verified and cannot create listings yet.',
        'PARTNER_NOT_VERIFIED',
      );
    }

    await this.#assertOwnerOrPermission(
      principal,
      input.partnerId,
      'listing.create',
    );

    const listingTypeId = await this.#listingRepository.findListingTypeIdByCode(
      input.listingType,
    );
    if (!listingTypeId) {
      throw new ValidationError('Unknown listing type.', [
        { field: 'listingType', issue: 'UNKNOWN_LISTING_TYPE' },
      ]);
    }

    const primaryTitle = input.translations[0].title;
    const slug = slugify(input.slug ?? primaryTitle);
    if (!slug) {
      throw new ValidationError(
        'A valid slug could not be derived from the provided title.',
        [{ field: 'slug', issue: 'INVALID' }],
      );
    }
    await this.#assertUniqueSlug(slug);

    const [draftStatusId, pendingModerationId] = await Promise.all([
      this.#listingRepository.findStatusIdByCode('DRAFT'),
      this.#listingRepository.findModerationStatusIdByCode('PENDING'),
    ]);

    const listingId = await withTransaction(async (connection) => {
      const newListingId = await this.#listingRepository.insertListing(
        {
          partnerId: input.partnerId,
          listingTypeId,
          slug,
          statusId: draftStatusId,
          moderationStatusId: pendingModerationId,
          isContactVisible: input.isContactVisible,
          createdBy: principal.userId,
        },
        connection,
      );

      // eslint-disable-next-line no-restricted-syntax -- translations must be inserted in order, sequentially
      for (const translation of input.translations) {
        // eslint-disable-next-line no-await-in-loop -- sequential by design, same connection/transaction
        await this.#listingRepository.insertTranslation(
          { listingId: newListingId, ...translation },
          connection,
        );
      }

      if (input.location) {
        await this.#listingRepository.upsertLocation(
          { listingId: newListingId, ...input.location },
          connection,
        );
      }
      if (input.categoryIds) {
        await this.#listingRepository.replaceCategoryLinks(
          newListingId,
          input.categoryIds,
          connection,
        );
      }
      if (input.amenityIds) {
        await this.#listingRepository.replaceAmenityLinks(
          newListingId,
          input.amenityIds,
          connection,
        );
      }

      return newListingId;
    });

    await this.#auditLogger.record({
      actorId: principal.userId,
      action: 'listing.created',
      targetType: 'listing',
      targetId: listingId,
      afterSnapshot: { partnerId: input.partnerId, slug },
    });

    return this.#listingRepository.findById(listingId);
  }

  async getListing(principal, id) {
    const listing = await this.#listingRepository.findById(id);
    if (!listing) throw new NotFoundError('Listing not found.');
    if (listing.statusCode === 'PUBLISHED') return listing;

    const allowed = await this.#isOwnerOrHasPermission(
      principal,
      listing.partnerId,
      'listing.update',
    );
    if (!allowed) throw new NotFoundError('Listing not found.');
    return listing;
  }

  async listListings(principal, filters = {}, paginationOpts = {}) {
    const { partnerId, listingType, status } = filters;
    const effectiveFilters = { partnerId, listingTypeCode: listingType };

    const wantsOwnerView =
      partnerId !== undefined &&
      (await this.#isOwnerOrHasPermission(
        principal,
        partnerId,
        'listing.update',
      ));

    if (wantsOwnerView) {
      if (status) effectiveFilters.statusCode = status;
    } else {
      effectiveFilters.onlyPublished = true;
    }

    return this.#listingRepository.list(effectiveFilters, paginationOpts);
  }

  async updateListing(principal, id, fields) {
    const listing = await this.#listingRepository.findById(id);
    if (!listing) throw new NotFoundError('Listing not found.');
    await this.#assertOwnerOrPermission(
      principal,
      listing.partnerId,
      'listing.update',
    );

    let nextSlug;
    if (fields.slug !== undefined) {
      nextSlug = slugify(fields.slug);
      if (!nextSlug) {
        throw new ValidationError(
          'A valid slug could not be derived from the provided value.',
          [{ field: 'slug', issue: 'INVALID' }],
        );
      }
      if (nextSlug !== listing.slug) {
        await this.#assertUniqueSlug(nextSlug, id);
      }
    }

    await withTransaction(async (connection) => {
      if (nextSlug !== undefined && nextSlug !== listing.slug) {
        await this.#listingRepository.recordSlugHistory(
          id,
          listing.slug,
          connection,
        );
      }

      await this.#listingRepository.update(
        id,
        {
          slug: nextSlug,
          canonicalUrl: fields.canonicalUrl,
          ogImageMediaId: fields.ogImageMediaId,
          isIndexable: fields.isIndexable,
          isSitemapIncluded: fields.isSitemapIncluded,
          isContactVisible: fields.isContactVisible,
          updatedBy: principal.userId,
        },
        connection,
      );

      if (fields.translations) {
        // eslint-disable-next-line no-restricted-syntax -- sequential by design
        for (const translation of fields.translations) {
          // eslint-disable-next-line no-await-in-loop -- same connection/transaction
          await this.#listingRepository.insertTranslation(
            { listingId: id, ...translation },
            connection,
          );
        }
      }
      if (fields.location) {
        await this.#listingRepository.upsertLocation(
          { listingId: id, ...fields.location },
          connection,
        );
      }
      if (fields.categoryIds) {
        await this.#listingRepository.replaceCategoryLinks(
          id,
          fields.categoryIds,
          connection,
        );
      }
      if (fields.amenityIds) {
        await this.#listingRepository.replaceAmenityLinks(
          id,
          fields.amenityIds,
          connection,
        );
      }
    });

    await this.#auditLogger.record({
      actorId: principal.userId,
      action: 'listing.updated',
      targetType: 'listing',
      targetId: id,
      afterSnapshot: fields,
    });

    return this.#listingRepository.findById(id);
  }

  async deleteListing(principal, id) {
    const listing = await this.#listingRepository.findById(id);
    if (!listing) throw new NotFoundError('Listing not found.');
    await this.#assertOwnerOrPermission(
      principal,
      listing.partnerId,
      'listing.delete',
    );

    await this.#listingRepository.softDelete(id, principal.userId);

    await this.#auditLogger.record({
      actorId: principal.userId,
      action: 'listing.deleted',
      targetType: 'listing',
      targetId: id,
    });
  }

  /**
   * Readiness check per API_SPECIFICATION.md §38: at least one translation,
   * at least one image, and a complete address/location. The additional
   * `bookable_unit`-existence check documented there is intentionally not
   * implemented — the Availability module doesn't exist yet (Sprint 7's
   * documented known limitation).
   */
  #checkPublishReadiness(listing) {
    const details = [];

    if (listing.translations.length === 0) {
      details.push({
        field: 'translations',
        issue: 'AT_LEAST_ONE_TRANSLATION_REQUIRED',
      });
    }

    const hasImage = listing.media.some(
      (media) =>
        media.mediaTypeCode === 'IMAGE' &&
        media.moderationStatusCode !== 'REJECTED',
    );
    if (!hasImage) {
      details.push({ field: 'media', issue: 'AT_LEAST_ONE_IMAGE_REQUIRED' });
    }

    // "Complete" means mappable/bookable — coordinates present.
    // `addressId`/`cityId` stay optional (nullable in listing_locations):
    // useful for display, not required to publish.
    const { location } = listing;
    const hasCompleteLocation = Boolean(
      location && location.latitude !== null && location.longitude !== null,
    );
    if (!hasCompleteLocation) {
      details.push({ field: 'location', issue: 'COMPLETE_LOCATION_REQUIRED' });
    }

    if (details.length > 0) {
      throw new ValidationError('Listing is not ready to publish.', details);
    }
  }

  async publishListing(principal, id) {
    const listing = await this.#listingRepository.findById(id);
    if (!listing) throw new NotFoundError('Listing not found.');
    await this.#assertOwnerOrPermission(
      principal,
      listing.partnerId,
      'listing.publish',
    );

    if (!isValidListingStatusTransition(listing.statusCode, 'PUBLISHED')) {
      throw new ConflictError(
        `A listing cannot be published from status "${listing.statusCode}".`,
        'INVALID_STATUS_TRANSITION',
      );
    }

    this.#checkPublishReadiness(listing);

    const publishedStatusId =
      await this.#listingRepository.findStatusIdByCode('PUBLISHED');
    await withTransaction((connection) =>
      this.#listingRepository.markPublished(
        id,
        publishedStatusId,
        principal.userId,
        connection,
      ),
    );

    await this.#auditLogger.record({
      actorId: principal.userId,
      action: 'listing.published',
      targetType: 'listing',
      targetId: id,
    });

    return this.#listingRepository.findById(id);
  }

  async unpublishListing(principal, id) {
    const listing = await this.#listingRepository.findById(id);
    if (!listing) throw new NotFoundError('Listing not found.');
    await this.#assertOwnerOrPermission(
      principal,
      listing.partnerId,
      'listing.publish',
    );

    if (!isValidListingStatusTransition(listing.statusCode, 'UNPUBLISHED')) {
      throw new ConflictError(
        `A listing cannot be unpublished from status "${listing.statusCode}".`,
        'INVALID_STATUS_TRANSITION',
      );
    }

    const unpublishedStatusId =
      await this.#listingRepository.findStatusIdByCode('UNPUBLISHED');
    await this.#listingRepository.markUnpublished(
      id,
      unpublishedStatusId,
      principal.userId,
    );

    await this.#auditLogger.record({
      actorId: principal.userId,
      action: 'listing.unpublished',
      targetType: 'listing',
      targetId: id,
    });

    return this.#listingRepository.findById(id);
  }

  async listMedia(principal, listingId) {
    // Reuses getListing's exact visibility rule (published -> public,
    // otherwise owner/permission-gated, else 404) rather than duplicating it.
    await this.getListing(principal, listingId);
    return this.#listingRepository.listMedia(listingId);
  }

  async attachMedia(principal, listingId, buffer, mimeType) {
    const listing = await this.#listingRepository.findById(listingId);
    if (!listing) throw new NotFoundError('Listing not found.');
    await this.#assertOwnerOrPermission(
      principal,
      listing.partnerId,
      'listing.update',
    );

    if (!isAllowedMimeType(mimeType)) {
      throw new ValidationError('Unsupported media type.');
    }
    if (!isWithinSizeLimit(mimeType, buffer.length)) {
      throw new ValidationError('Media file exceeds the maximum allowed size.');
    }

    const category = classifyMimeType(mimeType); // 'image' | 'video' | 'document'
    const extension = mimeType.split('/')[1];
    const key = `listings/${listingId}/${Date.now()}.${extension}`;
    const { url } = await this.#storageProvider.put(key, buffer, {
      contentType: mimeType,
    });

    const media = await this.#listingRepository.attachMedia({
      listingId,
      mediaTypeCode: category.toUpperCase(),
      url,
      mimeType,
      fileSizeBytes: buffer.length,
      ownerUserId: principal.userId,
      position: listing.media.length,
      isCover: listing.media.length === 0,
    });

    await this.#auditLogger.record({
      actorId: principal.userId,
      action: 'listing.media_attached',
      targetType: 'listing',
      targetId: listingId,
      afterSnapshot: { mediaId: media.id },
    });

    return media;
  }

  async updateMedia(principal, listingId, mediaId, fields) {
    const listing = await this.#listingRepository.findById(listingId);
    if (!listing) throw new NotFoundError('Listing not found.');
    await this.#assertOwnerOrPermission(
      principal,
      listing.partnerId,
      'listing.update',
    );

    const media = await this.#listingRepository.findMediaById(mediaId);
    if (!media || media.mediableId !== listingId) {
      throw new NotFoundError('Media not found for this listing.');
    }

    return this.#listingRepository.updateMedia(mediaId, {
      position: fields.position,
      isCover: fields.isCover,
      updatedBy: principal.userId,
    });
  }

  async removeMedia(principal, listingId, mediaId) {
    const listing = await this.#listingRepository.findById(listingId);
    if (!listing) throw new NotFoundError('Listing not found.');
    await this.#assertOwnerOrPermission(
      principal,
      listing.partnerId,
      'listing.update',
    );

    const media = await this.#listingRepository.findMediaById(mediaId);
    if (!media || media.mediableId !== listingId) {
      throw new NotFoundError('Media not found for this listing.');
    }

    await this.#listingRepository.removeMedia(mediaId, principal.userId);

    await this.#auditLogger.record({
      actorId: principal.userId,
      action: 'listing.media_removed',
      targetType: 'listing',
      targetId: listingId,
      afterSnapshot: { mediaId },
    });
  }
}

export default ListingService;
