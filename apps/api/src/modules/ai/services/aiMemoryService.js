/**
 * AiMemoryService (Phase 15) — the single gateway to `ai_user_memory`.
 *
 * Two call surfaces, deliberately different in shape:
 *  - Principal-facing methods (`getMemoryForUser`/`deleteMemoryKey`) back
 *    `GET /ai/memory`/`DELETE /ai/memory/:key` — always authenticated,
 *    always scoped to `principal.userId`, no way to read/delete another
 *    user's memory (no `userId` parameter is ever accepted from a caller).
 *  - System-facing methods (`recordDestinationAffinity`/
 *    `recordCategoryAffinity`) are called only by `events/aiListener.js`
 *    in reaction to a real domain event — `userId` comes from the event
 *    payload's `actorId`, not a request, so there is no principal to check.
 */

import { AuthenticationError } from '../../../errors/AppError.js';

export class AiMemoryService {
  #aiMemoryRepository;

  constructor({ aiMemoryRepository }) {
    this.#aiMemoryRepository = aiMemoryRepository;
  }

  async getMemoryForUser(principal) {
    if (!principal) throw new AuthenticationError();
    return this.#aiMemoryRepository.listForUser(principal.userId);
  }

  async deleteMemoryKey(principal, key) {
    if (!principal) throw new AuthenticationError();
    await this.#aiMemoryRepository.delete(principal.userId, key);
  }

  /** Read helper for feature services (e.g. Trip Planner) to personalize grounding data — still principal-scoped. */
  async getMemoryValue(principal, key) {
    if (!principal) throw new AuthenticationError();
    const entry = await this.#aiMemoryRepository.get(principal.userId, key);
    return entry?.value ?? null;
  }

  async recordDestinationAffinity(userId, cityCode, cityLabel) {
    if (!userId || !cityCode) return;
    await this.#aiMemoryRepository.incrementCounter(
      userId,
      `destination_affinity:${cityCode}`,
      cityLabel ?? cityCode,
    );
  }

  async recordCategoryAffinity(userId, categoryCode, categoryLabel) {
    if (!userId || !categoryCode) return;
    await this.#aiMemoryRepository.incrementCounter(
      userId,
      `category_affinity:${categoryCode}`,
      categoryLabel ?? categoryCode,
    );
  }
}

export default AiMemoryService;
