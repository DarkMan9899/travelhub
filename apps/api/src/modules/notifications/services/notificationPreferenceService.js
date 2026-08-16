/**
 * NotificationPreferenceService — Phase 13.
 *
 * Absence of a `notification_preferences` row means both channels are
 * enabled by default (Scope decision #7) — this service is what applies
 * that default; the repository only ever reflects what's actually
 * stored, never a default.
 */

import { ValidationError } from '../../../errors/AppError.js';

export class NotificationPreferenceService {
  #preferenceRepository;

  constructor({ preferenceRepository }) {
    this.#preferenceRepository = preferenceRepository;
  }

  /** Every known category, each with its effective (stored-or-default) settings. */
  async getPreferences(userId) {
    const [categoryCodes, overrides] = await Promise.all([
      this.#preferenceRepository.listCategoryCodes(),
      this.#preferenceRepository.listForUser(userId),
    ]);
    const overrideByCategory = new Map(
      overrides.map((override) => [override.categoryCode, override]),
    );

    return categoryCodes.map(
      (categoryCode) =>
        overrideByCategory.get(categoryCode) ?? {
          categoryCode,
          inAppEnabled: true,
          emailEnabled: true,
        },
    );
  }

  async updatePreference(userId, categoryCode, { inAppEnabled, emailEnabled }) {
    const categoryCodes = await this.#preferenceRepository.listCategoryCodes();
    if (!categoryCodes.includes(categoryCode)) {
      throw new ValidationError('Unknown notification category.', [
        { field: 'category', issue: 'UNKNOWN_CATEGORY' },
      ]);
    }
    return this.#preferenceRepository.upsert(userId, categoryCode, {
      inAppEnabled,
      emailEnabled,
    });
  }

  /** The one method the delivery step actually calls — defaults to enabled with no override row. */
  async isChannelEnabled(userId, categoryCode, channel) {
    const preference = await this.#preferenceRepository.findForUserAndCategory(
      userId,
      categoryCode,
    );
    if (!preference) return true;
    return channel === 'EMAIL'
      ? preference.emailEnabled
      : preference.inAppEnabled;
  }
}

export default NotificationPreferenceService;
