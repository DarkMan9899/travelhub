/**
 * MarketplaceConfigService — Stage 11.5 Admin Platform.
 *
 * Admin CRUD for the platform's simple lookup entities (categories,
 * amenities, pricing models, countries/regions/cities) — see
 * `mysqlMarketplaceConfigRepository.js`'s header comment for why this
 * module, not one of the existing feature modules, owns them.
 *
 * Deliberately excluded (per the Phase 11 plan's scope decision): the
 * EAV-style Dynamic Attributes / Search Filters / Policy-definition
 * editors — those are comparable in size to the engine that built their
 * read side and are left as a documented follow-up, not built here.
 *
 * Every mutation requires `marketplace.configure` and is audit-logged;
 * every read only requires the admin-area role already enforced by
 * `module.routes.js`'s `requireRole` — any admin-area user (including
 * SUPPORT/MODERATOR) can view configuration, only ADMIN/SUPER_ADMIN can
 * change it, matching the "nav/actions shown, permission enforced
 * server-side" convention `AdminLayout`'s own comment documents.
 */

import { NotFoundError, AuthorizationError } from '../../../errors/AppError.js';

const CONFIGURE_PERMISSION = 'marketplace.configure';

export class MarketplaceConfigService {
  #repository;

  #permissionResolver;

  #auditLogger;

  constructor({ repository, permissionResolver, auditLogger }) {
    this.#repository = repository;
    this.#permissionResolver = permissionResolver;
    this.#auditLogger = auditLogger;
  }

  async #assertCanConfigure(principal) {
    const granted = await this.#permissionResolver.hasPermission(
      principal.roles,
      CONFIGURE_PERMISSION,
    );
    if (!granted) throw new AuthorizationError();
  }

  async #audit(principal, action, targetType, targetId, before, after) {
    await this.#auditLogger.record({
      actorId: principal.userId,
      action,
      targetType,
      targetId,
      beforeSnapshot: before,
      afterSnapshot: after,
    });
  }

  // ---------------------------------------------------------------
  // Categories
  // ---------------------------------------------------------------

  async listCategories() {
    return this.#repository.listCategories();
  }

  async createCategory(principal, input) {
    await this.#assertCanConfigure(principal);
    const created = await this.#repository.createCategory(input);
    await this.#audit(
      principal,
      'marketplace.category_created',
      'listing_category',
      created.id,
      null,
      created,
    );
    return created;
  }

  async updateCategory(principal, id, input) {
    await this.#assertCanConfigure(principal);
    const before = await this.#repository.findCategoryById(id);
    if (!before) throw new NotFoundError('Category not found.');
    const updated = await this.#repository.updateCategory(id, input);
    await this.#audit(
      principal,
      'marketplace.category_updated',
      'listing_category',
      id,
      before,
      updated,
    );
    return updated;
  }

  async deleteCategory(principal, id) {
    await this.#assertCanConfigure(principal);
    const before = await this.#repository.findCategoryById(id);
    if (!before) throw new NotFoundError('Category not found.');
    await this.#repository.deleteCategory(id);
    await this.#audit(
      principal,
      'marketplace.category_deleted',
      'listing_category',
      id,
      before,
      null,
    );
  }

  // ---------------------------------------------------------------
  // Amenities
  // ---------------------------------------------------------------

  async listAmenities() {
    return this.#repository.listAmenities();
  }

  async listAmenityGroups() {
    return this.#repository.listAmenityGroups();
  }

  async createAmenity(principal, input) {
    await this.#assertCanConfigure(principal);
    const created = await this.#repository.createAmenity(input);
    await this.#audit(
      principal,
      'marketplace.amenity_created',
      'listing_amenity',
      created.id,
      null,
      created,
    );
    return created;
  }

  async updateAmenity(principal, id, input) {
    await this.#assertCanConfigure(principal);
    const before = await this.#repository.findAmenityById(id);
    if (!before) throw new NotFoundError('Amenity not found.');
    const updated = await this.#repository.updateAmenity(id, input);
    await this.#audit(
      principal,
      'marketplace.amenity_updated',
      'listing_amenity',
      id,
      before,
      updated,
    );
    return updated;
  }

  async deleteAmenity(principal, id) {
    await this.#assertCanConfigure(principal);
    const before = await this.#repository.findAmenityById(id);
    if (!before) throw new NotFoundError('Amenity not found.');
    await this.#repository.deleteAmenity(id);
    await this.#audit(
      principal,
      'marketplace.amenity_deleted',
      'listing_amenity',
      id,
      before,
      null,
    );
  }

  // ---------------------------------------------------------------
  // Pricing models
  // ---------------------------------------------------------------

  async listPricingModels() {
    return this.#repository.listPricingModels();
  }

  async createPricingModel(principal, input) {
    await this.#assertCanConfigure(principal);
    const created = await this.#repository.createPricingModel(input);
    await this.#audit(
      principal,
      'marketplace.pricing_model_created',
      'pricing_model',
      created.id,
      null,
      created,
    );
    return created;
  }

  async updatePricingModel(principal, id, input) {
    await this.#assertCanConfigure(principal);
    const before = await this.#repository.findPricingModelById(id);
    if (!before) throw new NotFoundError('Pricing model not found.');
    const updated = await this.#repository.updatePricingModel(id, input);
    await this.#audit(
      principal,
      'marketplace.pricing_model_updated',
      'pricing_model',
      id,
      before,
      updated,
    );
    return updated;
  }

  async deletePricingModel(principal, id) {
    await this.#assertCanConfigure(principal);
    const before = await this.#repository.findPricingModelById(id);
    if (!before) throw new NotFoundError('Pricing model not found.');
    await this.#repository.deletePricingModel(id);
    await this.#audit(
      principal,
      'marketplace.pricing_model_deleted',
      'pricing_model',
      id,
      before,
      null,
    );
  }

  // ---------------------------------------------------------------
  // Countries
  // ---------------------------------------------------------------

  async listCountries() {
    return this.#repository.listCountries();
  }

  async createCountry(principal, input) {
    await this.#assertCanConfigure(principal);
    const created = await this.#repository.createCountry(input);
    await this.#audit(
      principal,
      'marketplace.country_created',
      'country',
      created.id,
      null,
      created,
    );
    return created;
  }

  async updateCountry(principal, id, input) {
    await this.#assertCanConfigure(principal);
    const before = await this.#repository.findCountryById(id);
    if (!before) throw new NotFoundError('Country not found.');
    const updated = await this.#repository.updateCountry(id, input);
    await this.#audit(
      principal,
      'marketplace.country_updated',
      'country',
      id,
      before,
      updated,
    );
    return updated;
  }

  async deleteCountry(principal, id) {
    await this.#assertCanConfigure(principal);
    const before = await this.#repository.findCountryById(id);
    if (!before) throw new NotFoundError('Country not found.');
    await this.#repository.deleteCountry(id);
    await this.#audit(
      principal,
      'marketplace.country_deleted',
      'country',
      id,
      before,
      null,
    );
  }

  // ---------------------------------------------------------------
  // Regions
  // ---------------------------------------------------------------

  async listRegions(filters) {
    return this.#repository.listRegions(filters);
  }

  async createRegion(principal, input) {
    await this.#assertCanConfigure(principal);
    const created = await this.#repository.createRegion(input);
    await this.#audit(
      principal,
      'marketplace.region_created',
      'region',
      created.id,
      null,
      created,
    );
    return created;
  }

  async updateRegion(principal, id, input) {
    await this.#assertCanConfigure(principal);
    const before = await this.#repository.findRegionById(id);
    if (!before) throw new NotFoundError('Region not found.');
    const updated = await this.#repository.updateRegion(id, input);
    await this.#audit(
      principal,
      'marketplace.region_updated',
      'region',
      id,
      before,
      updated,
    );
    return updated;
  }

  async deleteRegion(principal, id) {
    await this.#assertCanConfigure(principal);
    const before = await this.#repository.findRegionById(id);
    if (!before) throw new NotFoundError('Region not found.');
    await this.#repository.deleteRegion(id);
    await this.#audit(
      principal,
      'marketplace.region_deleted',
      'region',
      id,
      before,
      null,
    );
  }

  // ---------------------------------------------------------------
  // Cities
  // ---------------------------------------------------------------

  async listCities(filters) {
    return this.#repository.listCities(filters);
  }

  async createCity(principal, input) {
    await this.#assertCanConfigure(principal);
    const created = await this.#repository.createCity(input);
    await this.#audit(
      principal,
      'marketplace.city_created',
      'city',
      created.id,
      null,
      created,
    );
    return created;
  }

  async updateCity(principal, id, input) {
    await this.#assertCanConfigure(principal);
    const before = await this.#repository.findCityById(id);
    if (!before) throw new NotFoundError('City not found.');
    const updated = await this.#repository.updateCity(id, input);
    await this.#audit(
      principal,
      'marketplace.city_updated',
      'city',
      id,
      before,
      updated,
    );
    return updated;
  }

  async deleteCity(principal, id) {
    await this.#assertCanConfigure(principal);
    const before = await this.#repository.findCityById(id);
    if (!before) throw new NotFoundError('City not found.');
    await this.#repository.deleteCity(id);
    await this.#audit(
      principal,
      'marketplace.city_deleted',
      'city',
      id,
      before,
      null,
    );
  }
}

export default MarketplaceConfigService;
