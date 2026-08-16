/**
 * Marketplace Configuration module Controller — Stage 11.5 Admin
 * Platform. Parse input -> call Service -> shape response, no logic.
 */

import {
  toCategoryResponse,
  toAmenityResponse,
  toAmenityGroupResponse,
  toPricingModelResponse,
  toCountryResponse,
  toRegionResponse,
  toCityResponse,
} from '../dto/marketplaceConfigDto.js';

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

export function createMarketplaceConfigController(marketplaceConfigService) {
  return {
    // Categories
    async listCategories(req, res, next) {
      try {
        const rows = await marketplaceConfigService.listCategories();
        jsonList(res, rows, toCategoryResponse);
      } catch (err) {
        next(err);
      }
    },
    async createCategory(req, res, next) {
      try {
        const created = await marketplaceConfigService.createCategory(
          req.principal,
          req.validated.body,
        );
        jsonItem(res, 201, created, toCategoryResponse);
      } catch (err) {
        next(err);
      }
    },
    async updateCategory(req, res, next) {
      try {
        const updated = await marketplaceConfigService.updateCategory(
          req.principal,
          req.validated.params.id,
          req.validated.body,
        );
        jsonItem(res, 200, updated, toCategoryResponse);
      } catch (err) {
        next(err);
      }
    },
    async deleteCategory(req, res, next) {
      try {
        await marketplaceConfigService.deleteCategory(
          req.principal,
          req.validated.params.id,
        );
        res.status(204).send();
      } catch (err) {
        next(err);
      }
    },

    // Amenities
    async listAmenities(req, res, next) {
      try {
        const rows = await marketplaceConfigService.listAmenities();
        jsonList(res, rows, toAmenityResponse);
      } catch (err) {
        next(err);
      }
    },
    async listAmenityGroups(req, res, next) {
      try {
        const rows = await marketplaceConfigService.listAmenityGroups();
        jsonList(res, rows, toAmenityGroupResponse);
      } catch (err) {
        next(err);
      }
    },
    async createAmenity(req, res, next) {
      try {
        const created = await marketplaceConfigService.createAmenity(
          req.principal,
          req.validated.body,
        );
        jsonItem(res, 201, created, toAmenityResponse);
      } catch (err) {
        next(err);
      }
    },
    async updateAmenity(req, res, next) {
      try {
        const updated = await marketplaceConfigService.updateAmenity(
          req.principal,
          req.validated.params.id,
          req.validated.body,
        );
        jsonItem(res, 200, updated, toAmenityResponse);
      } catch (err) {
        next(err);
      }
    },
    async deleteAmenity(req, res, next) {
      try {
        await marketplaceConfigService.deleteAmenity(
          req.principal,
          req.validated.params.id,
        );
        res.status(204).send();
      } catch (err) {
        next(err);
      }
    },

    // Pricing models
    async listPricingModels(req, res, next) {
      try {
        const rows = await marketplaceConfigService.listPricingModels();
        jsonList(res, rows, toPricingModelResponse);
      } catch (err) {
        next(err);
      }
    },
    async createPricingModel(req, res, next) {
      try {
        const created = await marketplaceConfigService.createPricingModel(
          req.principal,
          req.validated.body,
        );
        jsonItem(res, 201, created, toPricingModelResponse);
      } catch (err) {
        next(err);
      }
    },
    async updatePricingModel(req, res, next) {
      try {
        const updated = await marketplaceConfigService.updatePricingModel(
          req.principal,
          req.validated.params.id,
          req.validated.body,
        );
        jsonItem(res, 200, updated, toPricingModelResponse);
      } catch (err) {
        next(err);
      }
    },
    async deletePricingModel(req, res, next) {
      try {
        await marketplaceConfigService.deletePricingModel(
          req.principal,
          req.validated.params.id,
        );
        res.status(204).send();
      } catch (err) {
        next(err);
      }
    },

    // Countries
    async listCountries(req, res, next) {
      try {
        const rows = await marketplaceConfigService.listCountries();
        jsonList(res, rows, toCountryResponse);
      } catch (err) {
        next(err);
      }
    },
    async createCountry(req, res, next) {
      try {
        const created = await marketplaceConfigService.createCountry(
          req.principal,
          req.validated.body,
        );
        jsonItem(res, 201, created, toCountryResponse);
      } catch (err) {
        next(err);
      }
    },
    async updateCountry(req, res, next) {
      try {
        const updated = await marketplaceConfigService.updateCountry(
          req.principal,
          req.validated.params.id,
          req.validated.body,
        );
        jsonItem(res, 200, updated, toCountryResponse);
      } catch (err) {
        next(err);
      }
    },
    async deleteCountry(req, res, next) {
      try {
        await marketplaceConfigService.deleteCountry(
          req.principal,
          req.validated.params.id,
        );
        res.status(204).send();
      } catch (err) {
        next(err);
      }
    },

    // Regions
    async listRegions(req, res, next) {
      try {
        const rows = await marketplaceConfigService.listRegions({
          countryId: req.validated.query.countryId,
        });
        jsonList(res, rows, toRegionResponse);
      } catch (err) {
        next(err);
      }
    },
    async createRegion(req, res, next) {
      try {
        const created = await marketplaceConfigService.createRegion(
          req.principal,
          req.validated.body,
        );
        jsonItem(res, 201, created, toRegionResponse);
      } catch (err) {
        next(err);
      }
    },
    async updateRegion(req, res, next) {
      try {
        const updated = await marketplaceConfigService.updateRegion(
          req.principal,
          req.validated.params.id,
          req.validated.body,
        );
        jsonItem(res, 200, updated, toRegionResponse);
      } catch (err) {
        next(err);
      }
    },
    async deleteRegion(req, res, next) {
      try {
        await marketplaceConfigService.deleteRegion(
          req.principal,
          req.validated.params.id,
        );
        res.status(204).send();
      } catch (err) {
        next(err);
      }
    },

    // Cities
    async listCities(req, res, next) {
      try {
        const rows = await marketplaceConfigService.listCities({
          regionId: req.validated.query.regionId,
        });
        jsonList(res, rows, toCityResponse);
      } catch (err) {
        next(err);
      }
    },
    async createCity(req, res, next) {
      try {
        const created = await marketplaceConfigService.createCity(
          req.principal,
          req.validated.body,
        );
        jsonItem(res, 201, created, toCityResponse);
      } catch (err) {
        next(err);
      }
    },
    async updateCity(req, res, next) {
      try {
        const updated = await marketplaceConfigService.updateCity(
          req.principal,
          req.validated.params.id,
          req.validated.body,
        );
        jsonItem(res, 200, updated, toCityResponse);
      } catch (err) {
        next(err);
      }
    },
    async deleteCity(req, res, next) {
      try {
        await marketplaceConfigService.deleteCity(
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

export default createMarketplaceConfigController;
