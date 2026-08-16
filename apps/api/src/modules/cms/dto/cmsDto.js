/**
 * CMS module response DTOs — Stage 11.6 Admin Platform.
 */

export function toPageResponse(page) {
  return {
    id: page.id,
    slug: page.slug,
    is_published: page.isPublished,
    updated_at: page.updatedAt,
  };
}

export function toTranslationResponse(translation) {
  return {
    language_id: translation.languageId,
    language_code: translation.languageCode,
    title: translation.title,
    content: translation.content,
  };
}

export function toPageDetailResponse(page) {
  return {
    ...toPageResponse(page),
    translations: (page.translations ?? []).map(toTranslationResponse),
  };
}

export function toPublicPageResponse(page) {
  return {
    slug: page.slug,
    language_code: page.languageCode,
    title: page.title,
    content: page.content,
  };
}
