/**
 * MySQL-backed Partners repository.
 *
 * Phase 5's only Partners-module read was "which partner orgs does this
 * user belong to" (`listMembershipsForUser`). Phase 10 (redesign) adds
 * the module's first PUBLIC reads — a Companies directory and profile
 * page — built entirely on columns `partners` already had from Sprint 5
 * (`description`, `logo_media_id`, `cover_media_id`, `email`, `phone`,
 * `website`, `social_links`) that no UI had ever surfaced. Both new
 * queries scope to `moderation_status_id` = APPROVED, mirroring how
 * `listings`/`ls.code = 'PUBLISHED'` gates public listing visibility —
 * a partner pending/rejected moderation is not discoverable publicly,
 * same as a draft listing isn't. `listing_count` is a correlated
 * subquery counting only that partner's PUBLISHED listings, for the
 * same reason (a partner's draft listings aren't "their public
 * catalog"). Reviews/ratings are deliberately not selected — no Reviews
 * module/table exists anywhere in this schema.
 */

import { getMysqlPool } from '../../../infrastructure/database/mysqlPool.js';
import { mapMysqlError } from '../../../infrastructure/database/errorMapping.js';
import {
  decodeCursor,
  buildPageMeta,
} from '../../../infrastructure/database/pagination.js';

function toMembershipDomain(row) {
  return {
    partnerId: row.id,
    slug: row.slug,
    displayName: row.display_name,
    roleCode: row.role_code,
    // P1.2 (Master Roadmap): additive — lets a caller that does want the
    // full picture (listMembershipsForUserAdmin; a future "my
    // applications" list) distinguish a real, approved membership from
    // an in-progress application without a second query.
    verificationStatusCode: row.verification_status_code,
  };
}

function toPartnerSummaryDomain(row) {
  return {
    id: row.id,
    slug: row.slug,
    displayName: row.display_name,
    description: row.description,
    logoUrl: row.logo_url,
    coverUrl: row.cover_url,
    listingCount: Number(row.listing_count),
    isVerified: row.verification_status_code === 'APPROVED',
    memberSince: row.member_since,
    ratingAverage: row.rating_average ? Number(row.rating_average) : null,
    reviewCount: row.review_count ? Number(row.review_count) : 0,
  };
}

function toPartnerDetailDomain(row) {
  return {
    ...toPartnerSummaryDomain(row),
    email: row.email,
    phone: row.phone,
    website: row.website,
    socialLinks: row.social_links ? JSON.parse(row.social_links) : {},
  };
}

/**
 * Phase 11 Admin Platform: unlike the public summary/detail rows above
 * (scoped to APPROVED/non-deleted only), admin rows surface every
 * partner in any status plus both status codes side by side —
 * `verification_status_code` (PENDING/APPROVED/REJECTED, an admin's
 * onboarding decision) and `moderation_status_code` (APPROVED/FLAGGED,
 * an admin's "suspend"/"restore" decision on an already-verified
 * partner — see `partnerService.js`'s `updateModerationStatus` doc
 * comment for why `FLAGGED` is this schema's only "suspended" value).
 */
function toPartnerAdminSummaryDomain(row) {
  return {
    id: row.id,
    slug: row.slug,
    displayName: row.display_name,
    email: row.email,
    logoUrl: row.logo_url,
    verificationStatusCode: row.verification_status_code,
    moderationStatusCode: row.moderation_status_code,
    listingCount: Number(row.listing_count),
    createdAt: row.created_at,
  };
}

function toPartnerAdminDetailDomain(row) {
  return {
    ...toPartnerAdminSummaryDomain(row),
    legalName: row.legal_name,
    description: row.description,
    phone: row.phone,
    website: row.website,
    // P1.2 (Master Roadmap): the admin's feedback on a NEEDS_CHANGES (or
    // REJECTED) review decision — see updateVerificationStatus's own doc
    // comment for the full lifecycle.
    reviewNote: row.review_note,
    totalListingCount: Number(row.total_listing_count),
    publishedListingCount: Number(row.published_listing_count),
    ownerEmail: row.owner_email,
    ownerFirstName: row.owner_first_name,
    ownerLastName: row.owner_last_name,
  };
}

const PUBLIC_SELECT_COLUMNS = `
  p.id, p.slug, p.display_name, p.description, p.email, p.phone, p.website, p.social_links,
  p.created_at AS member_since,
  lm.url AS logo_url, cm.url AS cover_url, vms.code AS verification_status_code,
  (SELECT COUNT(*) FROM listings l
     JOIN listing_statuses ls ON ls.id = l.status_id
     WHERE l.partner_id = p.id AND l.deleted_at IS NULL AND ls.code = 'PUBLISHED'
  ) AS listing_count,
  -- Phase 18 (Premium Listing Detail — Host/Partner trust section):
  -- aggregate rating across the partner's own listings' approved
  -- reviews. Mirrors the exact same read-only aggregate pattern
  -- mysqlListingRepository.findById already uses for a single listing's
  -- rating_average/review_count — never a second write path over
  -- \`reviews\`.
  (SELECT AVG(rv.rating) FROM reviews rv
     JOIN moderation_statuses rms ON rms.id = rv.status_id
     JOIN listings rl ON rl.id = rv.listing_id
     WHERE rl.partner_id = p.id AND rms.code = 'APPROVED' AND rv.deleted_at IS NULL
  ) AS rating_average,
  (SELECT COUNT(*) FROM reviews rv
     JOIN moderation_statuses rms ON rms.id = rv.status_id
     JOIN listings rl ON rl.id = rv.listing_id
     WHERE rl.partner_id = p.id AND rms.code = 'APPROVED' AND rv.deleted_at IS NULL
  ) AS review_count
`;
const PUBLIC_FROM_JOINED = `
  FROM partners p
  JOIN moderation_statuses ms ON ms.id = p.moderation_status_id
  JOIN moderation_statuses vms ON vms.id = p.verification_status_id
  LEFT JOIN media lm ON lm.id = p.logo_media_id AND lm.deleted_at IS NULL
  LEFT JOIN media cm ON cm.id = p.cover_media_id AND cm.deleted_at IS NULL
`;

// Admin variants reuse the exact same FROM/JOIN chain as the public
// queries — only the WHERE clause (no APPROVED-only scoping) and the
// selected columns (both status codes, not just verification) differ.
const ADMIN_SELECT_COLUMNS = `
  p.id, p.slug, p.display_name, p.email,
  lm.url AS logo_url, vms.code AS verification_status_code, ms.code AS moderation_status_code,
  p.created_at,
  (SELECT COUNT(*) FROM listings l WHERE l.partner_id = p.id AND l.deleted_at IS NULL) AS listing_count
`;
const ADMIN_DETAIL_SELECT_COLUMNS = `
  p.id, p.slug, p.legal_name, p.display_name, p.description, p.email, p.phone, p.website,
  p.review_note,
  lm.url AS logo_url, vms.code AS verification_status_code, ms.code AS moderation_status_code,
  p.created_at,
  (SELECT COUNT(*) FROM listings l WHERE l.partner_id = p.id AND l.deleted_at IS NULL) AS total_listing_count,
  (SELECT COUNT(*) FROM listings l JOIN listing_statuses ls ON ls.id = l.status_id
     WHERE l.partner_id = p.id AND l.deleted_at IS NULL AND ls.code = 'PUBLISHED'
  ) AS published_listing_count,
  owner.email AS owner_email, owner.first_name AS owner_first_name, owner.last_name AS owner_last_name
`;
const ADMIN_FROM_JOINED = `${PUBLIC_FROM_JOINED}
  LEFT JOIN users owner ON owner.id = p.owner_user_id
`;

export class MySqlPartnerRepository {
  #pool;

  constructor(pool = getMysqlPool()) {
    this.#pool = pool;
  }

  /**
   * @param {number} userId
   * @param {{approvedOnly?: boolean}} [opts] P1.2 (Master Roadmap):
   *   `approvedOnly` excludes a DRAFT/PENDING/NEEDS_CHANGES/REJECTED
   *   application — real, capability-granting memberships only. Default
   *   `false` preserves this method's two other callers' existing
   *   behavior (`listMembershipsForUserAdmin`, and `applyToBecomePartner`'s
   *   own "do you already have one in progress" check, which needs to
   *   see exactly the statuses `approvedOnly` would hide). `GET
   *   /partners/mine` is the one caller that opts into `approvedOnly` —
   *   its response feeds `AuthContext`'s `partnerships` array, which
   *   `RequirePartner` uses to gate the entire partner dashboard; an
   *   applicant mid-review must not get real partner capabilities just
   *   because a `partner_employees` OWNER row already exists for their
   *   still-unapproved application.
   * @returns {Promise<Array<{partnerId, slug, displayName, roleCode}>>}
   */
  async listMembershipsForUser(userId, { approvedOnly = false } = {}) {
    const conditions = [
      'pe.user_id = ?',
      'pe.deleted_at IS NULL',
      'p.deleted_at IS NULL',
    ];
    if (approvedOnly) {
      conditions.push("vms.code = 'APPROVED'");
    }
    const [rows] = await this.#pool.query(
      `SELECT p.id, p.slug, p.display_name, per.code AS role_code, vms.code AS verification_status_code
       FROM partner_employees pe
       JOIN partners p ON p.id = pe.partner_id
       JOIN partner_employee_roles per ON per.id = pe.role_id
       JOIN moderation_statuses vms ON vms.id = p.verification_status_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY p.display_name ASC`,
      [userId],
    );
    return rows.map(toMembershipDomain);
  }

  /**
   * Public Companies directory — every APPROVED, non-deleted partner,
   * newest first. Phase 10.
   * @param {{cursor?: string|null, limit?: number}} [paginationOpts]
   */
  async listPublic({ cursor = null, limit = 20 } = {}) {
    const conditions = ['p.deleted_at IS NULL', "ms.code = 'APPROVED'"];
    const params = [];

    const decoded = decodeCursor(cursor);
    if (decoded?.id) {
      conditions.push('p.id < ?');
      params.push(decoded.id);
    }

    const [rows] = await this.#pool.query(
      `SELECT ${PUBLIC_SELECT_COLUMNS} ${PUBLIC_FROM_JOINED}
       WHERE ${conditions.join(' AND ')}
       ORDER BY p.id DESC
       LIMIT ?`,
      [...params, limit + 1],
    );

    const { rows: pageRows, meta } = buildPageMeta(rows, limit, (row) => ({
      id: row.id,
    }));
    return { rows: pageRows.map(toPartnerSummaryDomain), meta };
  }

  /**
   * Public Company profile — an APPROVED, non-deleted partner by slug.
   * Phase 10. Returns `null` for an unknown/unapproved/deleted slug —
   * the Service maps that to a 404, same as `findBySlug` misses do
   * everywhere else in this codebase (listings, categories).
   * @param {string} slug
   */
  async findPublicBySlug(slug) {
    const [rows] = await this.#pool.query(
      `SELECT ${PUBLIC_SELECT_COLUMNS} ${PUBLIC_FROM_JOINED}
       WHERE p.slug = ? AND p.deleted_at IS NULL AND ms.code = 'APPROVED'
       LIMIT 1`,
      [slug],
    );
    return rows[0] ? toPartnerDetailDomain(rows[0]) : null;
  }

  /**
   * Phase 11 Admin Platform admin list — every non-deleted partner
   * regardless of status, newest first. Keyword matches display name,
   * email, or slug.
   * @param {{keyword?: string, verificationStatus?: string, moderationStatus?: string, cursor?: string|null, limit?: number}} [opts]
   */
  async listAdmin({
    keyword,
    verificationStatus,
    moderationStatus,
    cursor = null,
    limit = 20,
  } = {}) {
    const conditions = ['p.deleted_at IS NULL'];
    const params = [];

    if (keyword) {
      conditions.push(
        '(p.display_name LIKE ? OR p.email LIKE ? OR p.slug LIKE ?)',
      );
      const pattern = `%${keyword}%`;
      params.push(pattern, pattern, pattern);
    }
    if (verificationStatus) {
      conditions.push('vms.code = ?');
      params.push(verificationStatus);
    }
    if (moderationStatus) {
      conditions.push('ms.code = ?');
      params.push(moderationStatus);
    }

    const decoded = decodeCursor(cursor);
    if (decoded?.id) {
      conditions.push('p.id < ?');
      params.push(decoded.id);
    }

    const [rows] = await this.#pool.query(
      `SELECT ${ADMIN_SELECT_COLUMNS} ${PUBLIC_FROM_JOINED}
       WHERE ${conditions.join(' AND ')}
       ORDER BY p.id DESC
       LIMIT ?`,
      [...params, limit + 1],
    );

    const { rows: pageRows, meta } = buildPageMeta(rows, limit, (row) => ({
      id: row.id,
    }));
    return { rows: pageRows.map(toPartnerAdminSummaryDomain), meta };
  }

  /**
   * Phase 11 Admin Platform admin detail — any non-deleted partner
   * regardless of status, plus listing stats and the owning user's
   * identity (`partners.owner_user_id`, set at creation, distinct from
   * the possibly-multiple `partner_employees` OWNER-role rows). Also the
   * P1.2 owner-facing "my application" read (same shape, gated
   * differently at the Service layer) — accepts an optional `connection`
   * so a caller inside an open transaction (`createApplication`) reads
   * back the row it just inserted on the SAME connection, not a pool
   * connection that can't see it pre-commit.
   * @param {number} id
   * @param {import('mysql2/promise').Pool|import('mysql2/promise').PoolConnection} [connection]
   */
  async findByIdAdmin(id, connection = this.#pool) {
    const [rows] = await connection.query(
      `SELECT ${ADMIN_DETAIL_SELECT_COLUMNS} ${ADMIN_FROM_JOINED}
       WHERE p.id = ? AND p.deleted_at IS NULL
       LIMIT 1`,
      [id],
    );
    return rows[0] ? toPartnerAdminDetailDomain(rows[0]) : null;
  }

  /**
   * P1.2 (Master Roadmap) — self-service partner onboarding.
   * `verification_status_id` starts at DRAFT; `moderation_status_id`
   * starts at PENDING (an unverified partner has no meaningful
   * moderation state yet — it must never start at APPROVED, which would
   * make an unreviewed company page publicly visible). Creates the
   * owning `partner_employees` OWNER row in the SAME transaction so
   * `GET /partners/mine` (already existing, unchanged) picks up the new
   * application immediately with zero special-casing.
   */
  async createApplication(
    {
      legalName,
      displayName,
      slug,
      description,
      email,
      phone,
      website,
      ownerUserId,
    },
    connection,
  ) {
    try {
      const [result] = await connection.query(
        `INSERT INTO partners
          (legal_name, display_name, slug, description, email, phone, website,
           verification_status_id, moderation_status_id, owner_user_id, created_by, updated_by)
         VALUES (?, ?, ?, ?, ?, ?, ?,
           (SELECT id FROM moderation_statuses WHERE code = 'DRAFT'),
           (SELECT id FROM moderation_statuses WHERE code = 'PENDING'),
           ?, ?, ?)`,
        [
          legalName,
          displayName,
          slug,
          description ?? null,
          email ?? null,
          phone ?? null,
          website ?? null,
          ownerUserId,
          ownerUserId,
          ownerUserId,
        ],
      );
      const partnerId = result.insertId;
      await connection.query(
        `INSERT INTO partner_employees (partner_id, user_id, role_id, created_by, updated_by)
         VALUES (?, ?, (SELECT id FROM partner_employee_roles WHERE code = 'OWNER'), ?, ?)`,
        [partnerId, ownerUserId, ownerUserId, ownerUserId],
      );
      return this.findByIdAdmin(partnerId, connection);
    } catch (err) {
      throw mapMysqlError(err);
    }
  }

  /** @param {string} slug @returns {Promise<boolean>} */
  async slugExists(slug, connection = this.#pool) {
    const [rows] = await connection.query(
      'SELECT id FROM partners WHERE active_slug = ? LIMIT 1',
      [slug],
    );
    return rows.length > 0;
  }

  /**
   * P1.2 — owner-side edit of an in-progress application. The Service
   * enforces that this only runs while `verification_status_id` is
   * DRAFT/NEEDS_CHANGES; the repository just writes whatever fields are
   * supplied (undefined = leave unchanged, matching every other
   * repository's partial-update convention in this codebase).
   */
  async updateApplication(
    id,
    { legalName, displayName, description, email, phone, website },
    connection = this.#pool,
  ) {
    const assignments = [];
    const values = [];
    if (legalName !== undefined) {
      assignments.push('legal_name = ?');
      values.push(legalName);
    }
    if (displayName !== undefined) {
      assignments.push('display_name = ?');
      values.push(displayName);
    }
    if (description !== undefined) {
      assignments.push('description = ?');
      values.push(description);
    }
    if (email !== undefined) {
      assignments.push('email = ?');
      values.push(email);
    }
    if (phone !== undefined) {
      assignments.push('phone = ?');
      values.push(phone);
    }
    if (website !== undefined) {
      assignments.push('website = ?');
      values.push(website);
    }
    if (assignments.length === 0) return this.findByIdAdmin(id, connection);
    values.push(id);
    await connection.query(
      `UPDATE partners SET ${assignments.join(', ')} WHERE id = ?`,
      values,
    );
    return this.findByIdAdmin(id, connection);
  }

  /**
   * @param {number} id
   * @param {string} statusCode DRAFT|PENDING|NEEDS_CHANGES|APPROVED|REJECTED
   * @param {{reviewNote?: string|null, alsoApproveModerationStatus?: boolean}} [opts]
   *   `alsoApproveModerationStatus`: P1.2 — a fresh application's
   *   `moderation_status_id` starts at PENDING (never APPROVED — see
   *   `createApplication`'s comment), so the one moment it must become
   *   publicly visible is exactly when an admin approves verification.
   *   Doing both in the SAME UPDATE keeps them atomic — there is no
   *   window where a partner is verification-APPROVED but still
   *   moderation-PENDING (and therefore invisible for no visible reason).
   */
  async updateVerificationStatus(
    id,
    statusCode,
    { reviewNote, alsoApproveModerationStatus = false } = {},
  ) {
    const assignments = [
      'verification_status_id = (SELECT id FROM moderation_statuses WHERE code = ?)',
    ];
    const values = [statusCode];
    if (reviewNote !== undefined) {
      assignments.push('review_note = ?');
      values.push(reviewNote);
    }
    if (alsoApproveModerationStatus) {
      assignments.push(
        "moderation_status_id = (SELECT id FROM moderation_statuses WHERE code = 'APPROVED')",
      );
    }
    values.push(id);
    await this.#pool.query(
      `UPDATE partners SET ${assignments.join(', ')} WHERE id = ?`,
      values,
    );
    return this.findByIdAdmin(id);
  }

  /**
   * @param {number} id
   * @param {string} statusCode APPROVED|FLAGGED — "restore"/"suspend"
   * (see `partnerService.js`'s doc comment for why this schema has no
   * literal SUSPENDED value).
   */
  async updateModerationStatus(id, statusCode) {
    await this.#pool.query(
      `UPDATE partners
       SET moderation_status_id = (SELECT id FROM moderation_statuses WHERE code = ?)
       WHERE id = ?`,
      [statusCode, id],
    );
    return this.findByIdAdmin(id);
  }

  /**
   * Phase 13 (Notifications): the reverse of `listMembershipsForUser` —
   * given a partner id, who should receive a partner-level notification
   * (approval status change, a new review/favorite on one of their
   * listings). Returns the earliest-added OWNER; a partner org can have
   * multiple OWNER rows, but exactly one recipient keeps notification
   * fan-out simple (no distribution list feature exists — that would be
   * a future Messaging-module concern).
   */
  async findOwnerUserId(partnerId) {
    const [rows] = await this.#pool.query(
      `SELECT pe.user_id
       FROM partner_employees pe
       JOIN partner_employee_roles per ON per.id = pe.role_id
       WHERE pe.partner_id = ? AND pe.deleted_at IS NULL AND per.code = 'OWNER'
       ORDER BY pe.created_at ASC
       LIMIT 1`,
      [partnerId],
    );
    return rows[0]?.user_id ?? null;
  }
}

export default MySqlPartnerRepository;
