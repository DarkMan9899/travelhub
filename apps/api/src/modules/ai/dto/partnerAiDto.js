/** Partner AI tools response DTO (Stage 15.5). Every tool returns the same shape: generated content for the partner to review, never auto-applied. */

export function toPartnerAiGenerationResponse(result) {
  return { content: result.content };
}

export default toPartnerAiGenerationResponse;
