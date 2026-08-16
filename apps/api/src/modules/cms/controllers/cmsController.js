/**
 * CMS module Controller — Stage 11.6 Admin Platform. Parse input -> call
 * Service -> shape response, no logic.
 */

import {
  toPageResponse,
  toPageDetailResponse,
  toTranslationResponse,
  toPublicPageResponse,
} from '../dto/cmsDto.js';

export function createCmsController(cmsService) {
  return {
    async getPublicPage(req, res, next) {
      try {
        const { slug } = req.validated.params;
        const locale = req.validated.query.locale || 'en';
        const page = await cmsService.getPublishedPage(slug, locale);
        res.status(200).json({
          success: true,
          data: toPublicPageResponse(page),
          meta: null,
          error: null,
        });
      } catch (err) {
        next(err);
      }
    },

    async listPages(req, res, next) {
      try {
        const rows = await cmsService.listPages();
        res.status(200).json({
          success: true,
          data: rows.map(toPageResponse),
          meta: null,
          error: null,
        });
      } catch (err) {
        next(err);
      }
    },

    async getPageDetail(req, res, next) {
      try {
        const page = await cmsService.getPageDetail(req.validated.params.id);
        res.status(200).json({
          success: true,
          data: toPageDetailResponse(page),
          meta: null,
          error: null,
        });
      } catch (err) {
        next(err);
      }
    },

    async createPage(req, res, next) {
      try {
        const created = await cmsService.createPage(
          req.principal,
          req.validated.body,
        );
        res.status(201).json({
          success: true,
          data: toPageResponse(created),
          meta: null,
          error: null,
        });
      } catch (err) {
        next(err);
      }
    },

    async updatePage(req, res, next) {
      try {
        const updated = await cmsService.updatePage(
          req.principal,
          req.validated.params.id,
          req.validated.body,
        );
        res.status(200).json({
          success: true,
          data: toPageResponse(updated),
          meta: null,
          error: null,
        });
      } catch (err) {
        next(err);
      }
    },

    async deletePage(req, res, next) {
      try {
        await cmsService.deletePage(req.principal, req.validated.params.id);
        res.status(204).send();
      } catch (err) {
        next(err);
      }
    },

    async upsertTranslation(req, res, next) {
      try {
        const { id, languageCode } = req.validated.params;
        const translations = await cmsService.upsertTranslation(
          req.principal,
          id,
          languageCode,
          req.validated.body,
        );
        res.status(200).json({
          success: true,
          data: translations.map(toTranslationResponse),
          meta: null,
          error: null,
        });
      } catch (err) {
        next(err);
      }
    },
  };
}

export default createCmsController;
