/**
 * Admin module route wiring (BACKEND_ARCHITECTURE.md §2: route wiring
 * only, no logic).
 *
 * Every route in this module requires one of the four admin-area roles
 * (`requireRole` — the first real use of this previously-unmounted
 * guard). Finer-grained actions added in later Phase 11 stages layer
 * `requirePermission` on top of this per-endpoint (e.g. only
 * ADMIN/SUPER_ADMIN can suspend a user, even though SUPPORT can view
 * this area) — `GET /dashboard` needs no extra permission since the
 * dashboard is common to all four admin-area roles.
 *
 * Stage 11.5 (Marketplace Configuration): every `/config/*` read is
 * available to any admin-area role (same "view without the permission to
 * mutate" convention as every other admin list); every write requires
 * `marketplace.configure` (ADMIN/SUPER_ADMIN only, per
 * `004_roles_and_permissions.js`).
 *
 * Stage 11.7 (Audit Logs): `GET /audit-logs` requires `audit.view` —
 * unlike every other admin list, this one is NOT open to every
 * admin-area role, since MODERATOR was never granted `audit.view`
 * (`004_roles_and_permissions.js`'s deliberate SUPPORT-only view-access
 * scoping). View-only: no write routes exist for this resource.
 *
 * Stage 11.8 (System Health): `GET /system-health` has no extra
 * permission, same as `GET /dashboard` — every admin-area role can view
 * infra status, nothing here is ever written to.
 *
 * Stage 11.9 (Settings): `/settings` and `/feature-flags` follow the
 * exact same read-open/write-gated shape as `/config/*`, gated by
 * `settings.manage` instead of `marketplace.configure`.
 */

import { Router } from 'express';
import {
  idParamsSchema,
  categoryBodySchema,
  updateCategorySchema,
  amenityBodySchema,
  updateAmenitySchema,
  pricingModelBodySchema,
  updatePricingModelSchema,
  countryBodySchema,
  updateCountrySchema,
  listRegionsQuerySchema,
  regionBodySchema,
  updateRegionSchema,
  listCitiesQuerySchema,
  cityBodySchema,
  updateCitySchema,
} from './validators/marketplaceConfigValidators.js';
import { listAuditLogsQuerySchema } from './validators/auditLogValidators.js';
import {
  idParamsSchema as settingsIdParamsSchema,
  settingBodySchema,
  updateSettingSchema,
  featureFlagBodySchema,
  updateFeatureFlagSchema,
} from './validators/settingsValidators.js';
import { validate } from '../../validation/validate.js';

const ADMIN_AREA_ROLES = ['ADMIN', 'SUPER_ADMIN', 'MODERATOR', 'SUPPORT'];

export default function createAdminRoutes({
  adminController,
  marketplaceConfigController: config,
  auditLogController,
  systemHealthController,
  settingsController,
  guards,
}) {
  const router = Router();
  const { requireAuth, requireRole, requirePermission } = guards;

  router.use(requireAuth, requireRole(...ADMIN_AREA_ROLES));

  router.get('/dashboard', adminController.getDashboard);

  const configure = requirePermission('marketplace.configure');

  router.get('/config/categories', config.listCategories);
  router.post(
    '/config/categories',
    configure,
    validate(categoryBodySchema),
    config.createCategory,
  );
  router.patch(
    '/config/categories/:id',
    configure,
    validate(updateCategorySchema),
    config.updateCategory,
  );
  router.delete(
    '/config/categories/:id',
    configure,
    validate(idParamsSchema),
    config.deleteCategory,
  );

  router.get('/config/amenity-groups', config.listAmenityGroups);
  router.get('/config/amenities', config.listAmenities);
  router.post(
    '/config/amenities',
    configure,
    validate(amenityBodySchema),
    config.createAmenity,
  );
  router.patch(
    '/config/amenities/:id',
    configure,
    validate(updateAmenitySchema),
    config.updateAmenity,
  );
  router.delete(
    '/config/amenities/:id',
    configure,
    validate(idParamsSchema),
    config.deleteAmenity,
  );

  router.get('/config/pricing-models', config.listPricingModels);
  router.post(
    '/config/pricing-models',
    configure,
    validate(pricingModelBodySchema),
    config.createPricingModel,
  );
  router.patch(
    '/config/pricing-models/:id',
    configure,
    validate(updatePricingModelSchema),
    config.updatePricingModel,
  );
  router.delete(
    '/config/pricing-models/:id',
    configure,
    validate(idParamsSchema),
    config.deletePricingModel,
  );

  router.get('/config/countries', config.listCountries);
  router.post(
    '/config/countries',
    configure,
    validate(countryBodySchema),
    config.createCountry,
  );
  router.patch(
    '/config/countries/:id',
    configure,
    validate(updateCountrySchema),
    config.updateCountry,
  );
  router.delete(
    '/config/countries/:id',
    configure,
    validate(idParamsSchema),
    config.deleteCountry,
  );

  router.get(
    '/config/regions',
    validate(listRegionsQuerySchema),
    config.listRegions,
  );
  router.post(
    '/config/regions',
    configure,
    validate(regionBodySchema),
    config.createRegion,
  );
  router.patch(
    '/config/regions/:id',
    configure,
    validate(updateRegionSchema),
    config.updateRegion,
  );
  router.delete(
    '/config/regions/:id',
    configure,
    validate(idParamsSchema),
    config.deleteRegion,
  );

  router.get(
    '/config/cities',
    validate(listCitiesQuerySchema),
    config.listCities,
  );
  router.post(
    '/config/cities',
    configure,
    validate(cityBodySchema),
    config.createCity,
  );
  router.patch(
    '/config/cities/:id',
    configure,
    validate(updateCitySchema),
    config.updateCity,
  );
  router.delete(
    '/config/cities/:id',
    configure,
    validate(idParamsSchema),
    config.deleteCity,
  );

  router.get(
    '/audit-logs',
    requirePermission('audit.view'),
    validate(listAuditLogsQuerySchema),
    auditLogController.list,
  );

  router.get('/system-health', systemHealthController.getSystemHealth);

  const manageSettings = requirePermission('settings.manage');

  router.get('/settings', settingsController.listSettings);
  router.post(
    '/settings',
    manageSettings,
    validate(settingBodySchema),
    settingsController.createSetting,
  );
  router.patch(
    '/settings/:id',
    manageSettings,
    validate(updateSettingSchema),
    settingsController.updateSetting,
  );
  router.delete(
    '/settings/:id',
    manageSettings,
    validate(settingsIdParamsSchema),
    settingsController.deleteSetting,
  );

  router.get('/feature-flags', settingsController.listFeatureFlags);
  router.post(
    '/feature-flags',
    manageSettings,
    validate(featureFlagBodySchema),
    settingsController.createFeatureFlag,
  );
  router.patch(
    '/feature-flags/:id',
    manageSettings,
    validate(updateFeatureFlagSchema),
    settingsController.updateFeatureFlag,
  );
  router.delete(
    '/feature-flags/:id',
    manageSettings,
    validate(settingsIdParamsSchema),
    settingsController.deleteFeatureFlag,
  );

  return router;
}
