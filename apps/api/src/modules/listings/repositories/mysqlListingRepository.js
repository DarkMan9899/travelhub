/**
 * MySQL implementation of the ListingRepository port.
 *
 * Owns `listings`, `listing_translations`, `listing_locations`,
 * `listing_category_listing`, `listing_amenity_listing`,
 * `listing_slug_history`, and the `mediable_type = 'listing'` slice of the
 * polymorphic `media` table (Module Catalog #7). Also owns a narrow
 * `partners`/`moderation_statuses` verification-status lookup
 * (`getPartnerVerification`) — a full Partners module doesn't exist yet, so
 * this stays scoped to exactly what listing creation needs, the same
 * precedent already set by `MySqlUserRepository.createAvatarMedia` for
 * media before a Media module existed.
 *
 * No single query joins the 1:N child tables (translations, media) with
 * the parent `listings` row — that would multiply rows and require
 * de-duplication in JS; separate targeted queries composed in `findById`
 * are simpler and equally correct for this foundation sprint.
 */

import { getMysqlPool } from '../../../infrastructure/database/mysqlPool.js';
import { mapMysqlError } from '../../../infrastructure/database/errorMapping.js';
import {
  scopeActive,
  softDeleteAssignment,
} from '../../../infrastructure/database/softDelete.js';
import {
  decodeCursor,
  buildPageMeta,
} from '../../../infrastructure/database/pagination.js';
import { ListingRepository as ListingRepositoryPort } from '../../../core/interfaces/ListingRepository.js';

const LISTING_SELECT_COLUMNS = `
  l.id, l.partner_id, l.listing_type_id, lt.code AS listing_type_code, l.slug,
  l.status_id, ls.code AS status_code, l.moderation_status_id, ms.code AS moderation_status_code,
  l.is_contact_visible, l.is_featured, l.published_at, l.unpublished_at,
  l.canonical_url, l.og_image_media_id, l.is_indexable, l.is_sitemap_included,
  l.created_at, l.updated_at, l.deleted_at, l.created_by, l.updated_by
`;
const FROM_LISTINGS_JOINED = `
  FROM listings l
  JOIN listing_types lt ON lt.id = l.listing_type_id
  JOIN listing_statuses ls ON ls.id = l.status_id
  JOIN moderation_statuses ms ON ms.id = l.moderation_status_id
`;

function toListingDomain(row) {
  if (!row) return null;
  return {
    id: row.id,
    partnerId: row.partner_id,
    listingTypeId: row.listing_type_id,
    listingTypeCode: row.listing_type_code,
    slug: row.slug,
    statusId: row.status_id,
    statusCode: row.status_code,
    moderationStatusId: row.moderation_status_id,
    moderationStatusCode: row.moderation_status_code,
    isContactVisible: Boolean(row.is_contact_visible),
    isFeatured: Boolean(row.is_featured),
    publishedAt: row.published_at,
    unpublishedAt: row.unpublished_at,
    canonicalUrl: row.canonical_url,
    ogImageMediaId: row.og_image_media_id,
    isIndexable: Boolean(row.is_indexable),
    isSitemapIncluded: Boolean(row.is_sitemap_included),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
  };
}

function toTranslationDomain(row) {
  return {
    id: row.id,
    listingId: row.listing_id,
    languageId: row.language_id,
    title: row.title,
    summary: row.summary,
    description: row.description,
    seoTitle: row.seo_title,
    seoDescription: row.seo_description,
  };
}

function toLocationDomain(row) {
  if (!row) return null;
  return {
    listingId: row.listing_id,
    addressId: row.address_id,
    cityId: row.city_id,
    latitude: row.latitude === null ? null : Number(row.latitude),
    longitude: row.longitude === null ? null : Number(row.longitude),
  };
}

function toMediaDomain(row) {
  return {
    id: row.id,
    mediableType: row.mediable_type,
    mediableId: row.mediable_id,
    mediaTypeId: row.media_type_id,
    mediaTypeCode: row.media_type_code,
    url: row.url,
    thumbnailUrl: row.thumbnail_url,
    position: row.position,
    isCover: Boolean(row.is_cover),
    uploadStatusId: row.upload_status_id,
    moderationStatusId: row.moderation_status_id,
    moderationStatusCode: row.moderation_status_code,
    mimeType: row.mime_type,
    fileSizeBytes: row.file_size_bytes,
    ownerUserId: row.owner_user_id,
    createdAt: row.created_at,
  };
}

export class MySqlListingRepository extends ListingRepositoryPort {
  #pool;

  constructor(pool = getMysqlPool()) {
    super();
    this.#pool = pool;
  }

  async insertListing(data, connection = this.#pool) {
    try {
      const [result] = await connection.query(
        `INSERT INTO listings
          (partner_id, listing_type_id, slug, status_id, moderation_status_id, is_contact_visible, created_by, updated_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          data.partnerId,
          data.listingTypeId,
          data.slug,
          data.statusId,
          data.moderationStatusId,
          data.isContactVisible ?? false,
          data.createdBy,
          data.createdBy,
        ],
      );
      return result.insertId;
    } catch (err) {
      throw mapMysqlError(err);
    }
  }

  async insertTranslation(
    {
      listingId,
      languageId,
      title,
      summary = null,
      description = null,
      seoTitle = null,
      seoDescription = null,
    },
    connection = this.#pool,
  ) {
    try {
      await connection.query(
        `INSERT INTO listing_translations
          (listing_id, language_id, title, summary, description, seo_title, seo_description)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           title = VALUES(title), summary = VALUES(summary), description = VALUES(description),
           seo_title = VALUES(seo_title), seo_description = VALUES(seo_description)`,
        [
          listingId,
          languageId,
          title,
          summary,
          description,
          seoTitle,
          seoDescription,
        ],
      );
    } catch (err) {
      throw mapMysqlError(err);
    }
  }

  /**
   * A `PATCH /listings/:id` with a partial `location` (e.g. only
   * `{latitude, longitude}`, set once coordinates are known separately
   * from the city) must not erase fields it didn't mention — `COALESCE`
   * keeps each column's existing value whenever the caller didn't supply
   * a new one, on both the first insert (existing value doesn't exist
   * yet, so it's simply the provided default) and every later update.
   */
  async upsertLocation(
    {
      listingId,
      addressId = null,
      cityId = null,
      latitude = null,
      longitude = null,
    },
    connection = this.#pool,
  ) {
    try {
      await connection.query(
        `INSERT INTO listing_locations (listing_id, address_id, city_id, latitude, longitude)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           address_id = COALESCE(VALUES(address_id), address_id),
           city_id = COALESCE(VALUES(city_id), city_id),
           latitude = COALESCE(VALUES(latitude), latitude),
           longitude = COALESCE(VALUES(longitude), longitude)`,
        [listingId, addressId, cityId, latitude, longitude],
      );
    } catch (err) {
      throw mapMysqlError(err);
    }
  }

  async replaceCategoryLinks(
    listingId,
    categoryIds = [],
    connection = this.#pool,
  ) {
    await connection.query(
      'DELETE FROM listing_category_listing WHERE listing_id = ?',
      [listingId],
    );
    if (categoryIds.length === 0) return;
    const values = categoryIds.map((categoryId) => [listingId, categoryId]);
    try {
      await connection.query(
        'INSERT INTO listing_category_listing (listing_id, category_id) VALUES ?',
        [values],
      );
    } catch (err) {
      throw mapMysqlError(err);
    }
  }

  async replaceAmenityLinks(
    listingId,
    amenityIds = [],
    connection = this.#pool,
  ) {
    await connection.query(
      'DELETE FROM listing_amenity_listing WHERE listing_id = ?',
      [listingId],
    );
    if (amenityIds.length === 0) return;
    const values = amenityIds.map((amenityId) => [listingId, amenityId]);
    try {
      await connection.query(
        'INSERT INTO listing_amenity_listing (listing_id, amenity_id) VALUES ?',
        [values],
      );
    } catch (err) {
      throw mapMysqlError(err);
    }
  }

  async recordSlugHistory(listingId, oldSlug, connection = this.#pool) {
    await connection.query(
      'INSERT INTO listing_slug_history (listing_id, old_slug) VALUES (?, ?)',
      [listingId, oldSlug],
    );
  }

  async findById(id, { includeTrashed = false } = {}, connection = this.#pool) {
    const [rows] = await connection.query(
      `SELECT ${LISTING_SELECT_COLUMNS} ${FROM_LISTINGS_JOINED} WHERE l.id = ? AND ${scopeActive('l', { includeTrashed })} LIMIT 1`,
      [id],
    );
    const listing = toListingDomain(rows[0]);
    if (!listing) return null;

    const [
      [translationRows],
      [locationRows],
      [categoryRows],
      [amenityRows],
      mediaRows,
    ] = await Promise.all([
      connection.query(
        'SELECT * FROM listing_translations WHERE listing_id = ?',
        [id],
      ),
      connection.query(
        'SELECT * FROM listing_locations WHERE listing_id = ? LIMIT 1',
        [id],
      ),
      connection.query(
        'SELECT category_id FROM listing_category_listing WHERE listing_id = ?',
        [id],
      ),
      connection.query(
        'SELECT amenity_id FROM listing_amenity_listing WHERE listing_id = ?',
        [id],
      ),
      this.listMedia(id, connection),
    ]);

    return {
      ...listing,
      translations: translationRows.map(toTranslationDomain),
      location: toLocationDomain(locationRows[0]),
      categoryIds: categoryRows.map((row) => row.category_id),
      amenityIds: amenityRows.map((row) => row.amenity_id),
      media: mediaRows,
    };
  }

  async findBySlug(slug, connection = this.#pool) {
    const [rows] = await connection.query(
      `SELECT ${LISTING_SELECT_COLUMNS} ${FROM_LISTINGS_JOINED} WHERE l.slug = ? AND ${scopeActive('l')} LIMIT 1`,
      [slug],
    );
    return toListingDomain(rows[0]);
  }

  async slugExists(slug, { excludeId = null } = {}, connection = this.#pool) {
    const conditions = ['active_slug = ?'];
    const params = [slug];
    if (excludeId !== null) {
      conditions.push('id != ?');
      params.push(excludeId);
    }
    const [rows] = await connection.query(
      `SELECT id FROM listings WHERE ${conditions.join(' AND ')} LIMIT 1`,
      params,
    );
    return rows.length > 0;
  }

  async list(
    filters = {},
    { cursor = null, limit = 20 } = {},
    connection = this.#pool,
  ) {
    const conditions = [scopeActive('l')];
    const params = [];

    if (filters.partnerId !== undefined) {
      conditions.push('l.partner_id = ?');
      params.push(filters.partnerId);
    }
    if (filters.listingTypeCode !== undefined) {
      conditions.push('lt.code = ?');
      params.push(filters.listingTypeCode);
    }
    if (filters.statusCode !== undefined) {
      conditions.push('ls.code = ?');
      params.push(filters.statusCode);
    } else if (filters.onlyPublished) {
      conditions.push("ls.code = 'PUBLISHED'");
    }

    const decoded = decodeCursor(cursor);
    if (decoded?.id) {
      conditions.push('l.id < ?');
      params.push(decoded.id);
    }

    const [rows] = await connection.query(
      `SELECT ${LISTING_SELECT_COLUMNS} ${FROM_LISTINGS_JOINED}
       WHERE ${conditions.join(' AND ')}
       ORDER BY l.id DESC
       LIMIT ?`,
      [...params, limit + 1],
    );

    const { rows: pageRows, meta } = buildPageMeta(rows, limit, (row) => ({
      id: row.id,
    }));
    return { rows: pageRows.map(toListingDomain), meta };
  }

  async update(id, fields, connection = this.#pool) {
    const columnMap = {
      canonicalUrl: 'canonical_url',
      ogImageMediaId: 'og_image_media_id',
      isIndexable: 'is_indexable',
      isSitemapIncluded: 'is_sitemap_included',
      isContactVisible: 'is_contact_visible',
      slug: 'slug',
      updatedBy: 'updated_by',
    };

    const assignments = [];
    const values = [];
    Object.entries(fields).forEach(([key, value]) => {
      const column = columnMap[key];
      if (column && value !== undefined) {
        assignments.push(`${column} = ?`);
        values.push(value);
      }
    });

    if (assignments.length > 0) {
      try {
        await connection.query(
          `UPDATE listings SET ${assignments.join(', ')} WHERE id = ?`,
          [...values, id],
        );
      } catch (err) {
        throw mapMysqlError(err);
      }
    }
  }

  /**
   * `published_at`/`unpublished_at` use the DB-side `UTC_TIMESTAMP(3)`
   * (same convention as `updateLastLoginAt` in mysqlUserRepository.js)
   * rather than an app-side `Date`, avoiding app/DB clock skew.
   * Unpublishing intentionally leaves `published_at` untouched — it
   * records the most recent publish moment, not "currently published."
   */
  async markPublished(id, statusId, updatedBy, connection = this.#pool) {
    await connection.query(
      `UPDATE listings
       SET status_id = ?, published_at = UTC_TIMESTAMP(3), unpublished_at = NULL, updated_by = ?
       WHERE id = ?`,
      [statusId, updatedBy, id],
    );
  }

  async markUnpublished(id, statusId, updatedBy, connection = this.#pool) {
    await connection.query(
      `UPDATE listings
       SET status_id = ?, unpublished_at = UTC_TIMESTAMP(3), updated_by = ?
       WHERE id = ?`,
      [statusId, updatedBy, id],
    );
  }

  async softDelete(id, deletedByUserId, connection = this.#pool) {
    await connection.query(
      `UPDATE listings SET ${softDeleteAssignment()}, deleted_by = ?, updated_by = ? WHERE id = ?`,
      [deletedByUserId, deletedByUserId, id],
    );
  }

  async listMedia(listingId, connection = this.#pool) {
    const [rows] = await connection.query(
      `SELECT m.*, mt.code AS media_type_code, mst.code AS moderation_status_code
       FROM media m
       JOIN media_types mt ON mt.id = m.media_type_id
       JOIN moderation_statuses mst ON mst.id = m.moderation_status_id
       WHERE m.mediable_type = 'listing' AND m.mediable_id = ? AND ${scopeActive('m')}
       ORDER BY m.position ASC, m.id ASC`,
      [listingId],
    );
    return rows.map(toMediaDomain);
  }

  async findMediaById(mediaId, connection = this.#pool) {
    const [rows] = await connection.query(
      `SELECT m.*, mt.code AS media_type_code, mst.code AS moderation_status_code
       FROM media m
       JOIN media_types mt ON mt.id = m.media_type_id
       JOIN moderation_statuses mst ON mst.id = m.moderation_status_id
       WHERE m.id = ? AND m.mediable_type = 'listing' AND ${scopeActive('m')}
       LIMIT 1`,
      [mediaId],
    );
    return rows[0] ? toMediaDomain(rows[0]) : null;
  }

  async attachMedia(
    {
      listingId,
      mediaTypeCode,
      url,
      mimeType,
      fileSizeBytes,
      ownerUserId,
      position,
      isCover,
    },
    connection = this.#pool,
  ) {
    const [[mediaType]] = await connection.query(
      'SELECT id FROM media_types WHERE code = ?',
      [mediaTypeCode],
    );
    const [[completedStatus]] = await connection.query(
      "SELECT id FROM media_upload_statuses WHERE code = 'COMPLETED'",
    );
    const [[pendingStatus]] = await connection.query(
      "SELECT id FROM moderation_statuses WHERE code = 'PENDING'",
    );

    try {
      const [result] = await connection.query(
        `INSERT INTO media
          (mediable_type, mediable_id, media_type_id, url, position, is_cover, upload_status_id, moderation_status_id, mime_type, file_size_bytes, owner_user_id, created_by, updated_by)
         VALUES ('listing', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          listingId,
          mediaType.id,
          url,
          position,
          isCover ? 1 : 0,
          completedStatus.id,
          pendingStatus.id,
          mimeType,
          fileSizeBytes,
          ownerUserId,
          ownerUserId,
          ownerUserId,
        ],
      );
      return this.findMediaById(result.insertId, connection);
    } catch (err) {
      throw mapMysqlError(err);
    }
  }

  async updateMedia(mediaId, fields, connection = this.#pool) {
    const assignments = [];
    const values = [];
    if (fields.position !== undefined) {
      assignments.push('position = ?');
      values.push(fields.position);
    }
    if (fields.isCover !== undefined) {
      assignments.push('is_cover = ?');
      values.push(fields.isCover ? 1 : 0);
    }
    if (fields.updatedBy !== undefined) {
      assignments.push('updated_by = ?');
      values.push(fields.updatedBy);
    }

    if (assignments.length > 0) {
      await connection.query(
        `UPDATE media SET ${assignments.join(', ')} WHERE id = ?`,
        [...values, mediaId],
      );
    }
    return this.findMediaById(mediaId, connection);
  }

  async removeMedia(mediaId, deletedByUserId, connection = this.#pool) {
    await connection.query(
      `UPDATE media SET ${softDeleteAssignment()}, deleted_by = ?, updated_by = ? WHERE id = ?`,
      [deletedByUserId, deletedByUserId, mediaId],
    );
  }

  /**
   * Narrow, scoped lookup — see this file's header comment. Not a general
   * Partners repository; only what `ListingService.createListing` needs.
   */
  async getPartnerVerification(partnerId, connection = this.#pool) {
    const [rows] = await connection.query(
      `SELECT ms.code AS verification_status_code
       FROM partners p
       JOIN moderation_statuses ms ON ms.id = p.verification_status_id
       WHERE p.id = ? AND ${scopeActive('p')}
       LIMIT 1`,
      [partnerId],
    );
    if (rows.length === 0)
      return { exists: false, verificationStatusCode: null };
    return {
      exists: true,
      verificationStatusCode: rows[0].verification_status_code,
    };
  }

  async findListingTypeIdByCode(code, connection = this.#pool) {
    const [rows] = await connection.query(
      'SELECT id FROM listing_types WHERE code = ? LIMIT 1',
      [code],
    );
    return rows[0]?.id ?? null;
  }

  async findStatusIdByCode(code, connection = this.#pool) {
    const [rows] = await connection.query(
      'SELECT id FROM listing_statuses WHERE code = ? LIMIT 1',
      [code],
    );
    return rows[0]?.id ?? null;
  }

  async findModerationStatusIdByCode(code, connection = this.#pool) {
    const [rows] = await connection.query(
      'SELECT id FROM moderation_statuses WHERE code = ? LIMIT 1',
      [code],
    );
    return rows[0]?.id ?? null;
  }
}

export default MySqlListingRepository;
