/**
 * Settings module Controller — Stage 11.9 Admin Platform. Parse input ->
 * call Service -> shape response, no logic.
 */

import {
  toSettingResponse,
  toFeatureFlagResponse,
} from '../dto/settingsDto.js';

function jsonList(res, rows, toResponse) {
  res.status(200).json({
    success: true,
    data: rows.map(toResponse),
    meta: null,
    error: null,
  });
}

function jsonItem(res, status, item, toResponse) {
  res.status(status).json({
    success: true,
    data: toResponse(item),
    meta: null,
    error: null,
  });
}

export function createSettingsController(settingsService) {
  return {
    // System settings
    async listSettings(req, res, next) {
      try {
        const rows = await settingsService.listSettings();
        jsonList(res, rows, toSettingResponse);
      } catch (err) {
        next(err);
      }
    },
    async createSetting(req, res, next) {
      try {
        const created = await settingsService.createSetting(
          req.principal,
          req.validated.body,
        );
        jsonItem(res, 201, created, toSettingResponse);
      } catch (err) {
        next(err);
      }
    },
    async updateSetting(req, res, next) {
      try {
        const updated = await settingsService.updateSetting(
          req.principal,
          req.validated.params.id,
          req.validated.body,
        );
        jsonItem(res, 200, updated, toSettingResponse);
      } catch (err) {
        next(err);
      }
    },
    async deleteSetting(req, res, next) {
      try {
        await settingsService.deleteSetting(
          req.principal,
          req.validated.params.id,
        );
        res.status(204).send();
      } catch (err) {
        next(err);
      }
    },

    // Feature flags
    async listFeatureFlags(req, res, next) {
      try {
        const rows = await settingsService.listFeatureFlags();
        jsonList(res, rows, toFeatureFlagResponse);
      } catch (err) {
        next(err);
      }
    },
    async createFeatureFlag(req, res, next) {
      try {
        const created = await settingsService.createFeatureFlag(
          req.principal,
          req.validated.body,
        );
        jsonItem(res, 201, created, toFeatureFlagResponse);
      } catch (err) {
        next(err);
      }
    },
    async updateFeatureFlag(req, res, next) {
      try {
        const updated = await settingsService.updateFeatureFlag(
          req.principal,
          req.validated.params.id,
          req.validated.body,
        );
        jsonItem(res, 200, updated, toFeatureFlagResponse);
      } catch (err) {
        next(err);
      }
    },
    async deleteFeatureFlag(req, res, next) {
      try {
        await settingsService.deleteFeatureFlag(
          req.principal,
          req.validated.params.id,
        );
        res.status(204).send();
      } catch (err) {
        next(err);
      }
    },
  };
}

export default createSettingsController;
