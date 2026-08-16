/** Partner AI tools Controller (Stage 15.5) — parse input -> call Service -> shape response. */

import { toPartnerAiGenerationResponse } from '../dto/partnerAiDto.js';

function handler(serviceMethod) {
  return async (req, res, next) => {
    try {
      const result = await serviceMethod(
        req.principal,
        req.validated.params.listingId,
        req.validated.body,
      );
      res.status(200).json({
        success: true,
        data: toPartnerAiGenerationResponse(result),
        meta: null,
        error: null,
      });
    } catch (err) {
      next(err);
    }
  };
}

export function createPartnerAiController(partnerAiService) {
  return {
    generateDescription: handler((principal, listingId) =>
      partnerAiService.generateDescription(principal, listingId),
    ),
    generateSeo: handler((principal, listingId) =>
      partnerAiService.generateSeo(principal, listingId),
    ),
    generateTitle: handler((principal, listingId, body) =>
      partnerAiService.generateTitle(principal, listingId, body),
    ),
    generateAmenities: handler((principal, listingId) =>
      partnerAiService.generateAmenities(principal, listingId),
    ),
    translate: handler((principal, listingId, body) =>
      partnerAiService.translate(principal, listingId, body),
    ),
    generateFaqs: handler((principal, listingId) =>
      partnerAiService.generateFaqs(principal, listingId),
    ),
  };
}

export default createPartnerAiController;
