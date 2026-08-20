/**
 * Partners module response DTOs (BACKEND_ARCHITECTURE.md Ch.9).
 */

export function toPartnershipResponse(membership) {
  return {
    partner_id: membership.partnerId,
    slug: membership.slug,
    display_name: membership.displayName,
    role: membership.roleCode,
    // P1.2 (Master Roadmap) — additive.
    verification_status: membership.verificationStatusCode,
  };
}

/** Companies directory row — Phase 10. */
export function toPartnerSummaryResponse(partner) {
  return {
    id: partner.id,
    slug: partner.slug,
    display_name: partner.displayName,
    description: partner.description,
    logo_url: partner.logoUrl,
    cover_url: partner.coverUrl,
    listing_count: partner.listingCount,
    is_verified: partner.isVerified,
    member_since: partner.memberSince,
    rating_average: partner.ratingAverage,
    review_count: partner.reviewCount,
  };
}

/** Company profile — Phase 10. Additive to the summary shape above. */
export function toPartnerDetailResponse(partner) {
  return {
    ...toPartnerSummaryResponse(partner),
    email: partner.email,
    phone: partner.phone,
    website: partner.website,
    social_links: partner.socialLinks,
  };
}

/** Stage 11.2 admin list row — every partner, both status codes surfaced. */
export function toAdminPartnerSummaryResponse(partner) {
  return {
    id: partner.id,
    slug: partner.slug,
    display_name: partner.displayName,
    email: partner.email,
    logo_url: partner.logoUrl,
    verification_status: partner.verificationStatusCode,
    moderation_status: partner.moderationStatusCode,
    listing_count: partner.listingCount,
    created_at: partner.createdAt,
  };
}

/** Stage 11.2 admin detail — additive to the admin summary shape above. Also the shape returned by every P1.2 self-service application endpoint (same underlying repository read, owner-gated instead of permission-gated). */
export function toAdminPartnerDetailResponse(partner) {
  return {
    ...toAdminPartnerSummaryResponse(partner),
    legal_name: partner.legalName,
    description: partner.description,
    phone: partner.phone,
    website: partner.website,
    review_note: partner.reviewNote ?? null,
    total_listing_count: partner.totalListingCount,
    published_listing_count: partner.publishedListingCount,
    owner: partner.ownerEmail
      ? {
          email: partner.ownerEmail,
          first_name: partner.ownerFirstName,
          last_name: partner.ownerLastName,
        }
      : null,
  };
}
