/**
 * Partner AI tool mutations (Stage 15.5) — six thin wraps, one per
 * `POST /ai/partner/listings/:listingId/*` tool. Every one returns
 * generated content for the partner to review and copy themselves —
 * none of them write to the listing.
 */

import { useMutation } from '@tanstack/react-query';
import {
  generateListingDescription,
  generateListingSeo,
  generateListingTitle,
  generateListingAmenities,
  translateListing,
  generateListingFaqs,
} from '../../../api/ai.js';

export function useGenerateListingDescriptionMutation() {
  return useMutation({
    mutationFn: (listingId) => generateListingDescription(listingId),
  });
}

export function useGenerateListingSeoMutation() {
  return useMutation({
    mutationFn: (listingId) => generateListingSeo(listingId),
  });
}

export function useGenerateListingTitleMutation() {
  return useMutation({
    mutationFn: ({ listingId, keyFeature }) =>
      generateListingTitle(listingId, keyFeature),
  });
}

export function useGenerateListingAmenitiesMutation() {
  return useMutation({
    mutationFn: (listingId) => generateListingAmenities(listingId),
  });
}

export function useTranslateListingMutation() {
  return useMutation({
    mutationFn: ({ listingId, targetLanguageCode }) =>
      translateListing(listingId, targetLanguageCode),
  });
}

export function useGenerateListingFaqsMutation() {
  return useMutation({
    mutationFn: (listingId) => generateListingFaqs(listingId),
  });
}
