/**
 * MySQL-backed Marketplace Configuration repository — Stage 11.5 Admin
 * Platform.
 *
 * Owns admin CRUD for the platform's simple, previously seed-only lookup
 * tables: listing categories, amenities (+ read-only amenity groups for
 * the picker), pricing models, and the countries -> regions -> cities
 * geography hierarchy. None of these tables had a dedicated owning
 * module before this stage — every existing read of them
 * (`mysqlListingMetadataRepository.js`, `mysqlSearchRepository.js`) only
 * ever JOINs against them for a *different* entity's own query, never
 * exposes CRUD on the rows themselves. Per this module's own `adminService.js`
 * header comment ("per-entity admin actions belong in their own existing
 * modules"), that convention assumes an existing owning module — these
 * six tables have none, so the cross-cutting `admin` module is the
 * correct, not a default, home for their first CRUD surface.
 *
 * Every write goes through `#run`, which maps a raw MySQL driver error
 * (duplicate slug/code, or a delete blocked by an in-use FK — e.g. a
 * category still referenced by listings) to the platform's Exception
 * Hierarchy via `mapMysqlError`, per `errorMapping.js`'s own documented
 * usage — a Repository never lets a raw driver error escape.
 */

import { getMysqlPool } from '../../../infrastructure/database/mysqlPool.js';
import { mapMysqlError } from '../../../infrastructure/database/errorMapping.js';

function toCategoryDomain(row) {
  return {
    id: row.id,
    parentId: row.parent_id,
    name: row.name,
    slug: row.slug,
    createdAt: row.created_at,
  };
}

function toAmenityDomain(row) {
  return {
    id: row.id,
    name: row.name,
    amenityGroupId: row.amenity_group_id,
    amenityGroupName: row.amenity_group_name ?? null,
    createdAt: row.created_at,
  };
}

function toAmenityGroupDomain(row) {
  return { id: row.id, code: row.code, name: row.name };
}

function toPricingModelDomain(row) {
  return { id: row.id, code: row.code, name: row.name };
}

function toCountryDomain(row) {
  return { id: row.id, isoCode: row.iso_code, name: row.name };
}

function toRegionDomain(row) {
  return { id: row.id, countryId: row.country_id, name: row.name };
}

function toCityDomain(row) {
  return {
    id: row.id,
    regionId: row.region_id,
    name: row.name,
    slug: row.slug,
    latitude: row.latitude,
    longitude: row.longitude,
  };
}

export class MySqlMarketplaceConfigRepository {
  #pool;

  constructor(pool = getMysqlPool()) {
    this.#pool = pool;
  }

  async #run(sql, params) {
    try {
      return await this.#pool.query(sql, params);
    } catch (err) {
      throw mapMysqlError(err);
    }
  }

  // ---------------------------------------------------------------
  // Categories
  // ---------------------------------------------------------------

  async listCategories() {
    const [rows] = await this.#run(
      'SELECT id, parent_id, name, slug, created_at FROM listing_categories ORDER BY name ASC',
    );
    return rows.map(toCategoryDomain);
  }

  async findCategoryById(id) {
    const [rows] = await this.#run(
      'SELECT id, parent_id, name, slug, created_at FROM listing_categories WHERE id = ?',
      [id],
    );
    return rows[0] ? toCategoryDomain(rows[0]) : null;
  }

  async createCategory({ name, slug, parentId }) {
    const [result] = await this.#run(
      'INSERT INTO listing_categories (name, slug, parent_id) VALUES (?, ?, ?)',
      [name, slug, parentId ?? null],
    );
    return this.findCategoryById(result.insertId);
  }

  async updateCategory(id, { name, slug, parentId }) {
    await this.#run(
      'UPDATE listing_categories SET name = ?, slug = ?, parent_id = ? WHERE id = ?',
      [name, slug, parentId ?? null, id],
    );
    return this.findCategoryById(id);
  }

  async deleteCategory(id) {
    await this.#run('DELETE FROM listing_categories WHERE id = ?', [id]);
  }

  // ---------------------------------------------------------------
  // Amenities (+ read-only groups)
  // ---------------------------------------------------------------

  async listAmenityGroups() {
    const [rows] = await this.#run(
      'SELECT id, code, name FROM amenity_groups ORDER BY sort_order ASC, name ASC',
    );
    return rows.map(toAmenityGroupDomain);
  }

  async listAmenities() {
    const [rows] = await this.#run(
      `SELECT la.id, la.name, la.amenity_group_id, ag.name AS amenity_group_name,
              la.created_at
       FROM listing_amenities la
       LEFT JOIN amenity_groups ag ON ag.id = la.amenity_group_id
       ORDER BY la.name ASC`,
    );
    return rows.map(toAmenityDomain);
  }

  async findAmenityById(id) {
    const [rows] = await this.#run(
      `SELECT la.id, la.name, la.amenity_group_id, ag.name AS amenity_group_name,
              la.created_at
       FROM listing_amenities la
       LEFT JOIN amenity_groups ag ON ag.id = la.amenity_group_id
       WHERE la.id = ?`,
      [id],
    );
    return rows[0] ? toAmenityDomain(rows[0]) : null;
  }

  async createAmenity({ name, amenityGroupId }) {
    const [result] = await this.#run(
      'INSERT INTO listing_amenities (name, amenity_group_id) VALUES (?, ?)',
      [name, amenityGroupId ?? null],
    );
    return this.findAmenityById(result.insertId);
  }

  async updateAmenity(id, { name, amenityGroupId }) {
    await this.#run(
      'UPDATE listing_amenities SET name = ?, amenity_group_id = ? WHERE id = ?',
      [name, amenityGroupId ?? null, id],
    );
    return this.findAmenityById(id);
  }

  async deleteAmenity(id) {
    await this.#run('DELETE FROM listing_amenities WHERE id = ?', [id]);
  }

  // ---------------------------------------------------------------
  // Pricing models
  // ---------------------------------------------------------------

  async listPricingModels() {
    const [rows] = await this.#run(
      'SELECT id, code, name FROM pricing_models ORDER BY name ASC',
    );
    return rows.map(toPricingModelDomain);
  }

  async findPricingModelById(id) {
    const [rows] = await this.#run(
      'SELECT id, code, name FROM pricing_models WHERE id = ?',
      [id],
    );
    return rows[0] ? toPricingModelDomain(rows[0]) : null;
  }

  async createPricingModel({ code, name }) {
    const [result] = await this.#run(
      'INSERT INTO pricing_models (code, name) VALUES (?, ?)',
      [code, name],
    );
    return this.findPricingModelById(result.insertId);
  }

  async updatePricingModel(id, { code, name }) {
    await this.#run(
      'UPDATE pricing_models SET code = ?, name = ? WHERE id = ?',
      [code, name, id],
    );
    return this.findPricingModelById(id);
  }

  async deletePricingModel(id) {
    await this.#run('DELETE FROM pricing_models WHERE id = ?', [id]);
  }

  // ---------------------------------------------------------------
  // Countries
  // ---------------------------------------------------------------

  async listCountries() {
    const [rows] = await this.#run(
      'SELECT id, iso_code, name FROM countries ORDER BY name ASC',
    );
    return rows.map(toCountryDomain);
  }

  async findCountryById(id) {
    const [rows] = await this.#run(
      'SELECT id, iso_code, name FROM countries WHERE id = ?',
      [id],
    );
    return rows[0] ? toCountryDomain(rows[0]) : null;
  }

  async createCountry({ isoCode, name }) {
    const [result] = await this.#run(
      'INSERT INTO countries (iso_code, name) VALUES (?, ?)',
      [isoCode, name],
    );
    return this.findCountryById(result.insertId);
  }

  async updateCountry(id, { isoCode, name }) {
    await this.#run(
      'UPDATE countries SET iso_code = ?, name = ? WHERE id = ?',
      [isoCode, name, id],
    );
    return this.findCountryById(id);
  }

  async deleteCountry(id) {
    await this.#run('DELETE FROM countries WHERE id = ?', [id]);
  }

  // ---------------------------------------------------------------
  // Regions
  // ---------------------------------------------------------------

  async listRegions({ countryId } = {}) {
    const [rows] = await this.#run(
      countryId
        ? 'SELECT id, country_id, name FROM regions WHERE country_id = ? ORDER BY name ASC'
        : 'SELECT id, country_id, name FROM regions ORDER BY name ASC',
      countryId ? [countryId] : [],
    );
    return rows.map(toRegionDomain);
  }

  async findRegionById(id) {
    const [rows] = await this.#run(
      'SELECT id, country_id, name FROM regions WHERE id = ?',
      [id],
    );
    return rows[0] ? toRegionDomain(rows[0]) : null;
  }

  async createRegion({ countryId, name }) {
    const [result] = await this.#run(
      'INSERT INTO regions (country_id, name) VALUES (?, ?)',
      [countryId, name],
    );
    return this.findRegionById(result.insertId);
  }

  async updateRegion(id, { countryId, name }) {
    await this.#run(
      'UPDATE regions SET country_id = ?, name = ? WHERE id = ?',
      [countryId, name, id],
    );
    return this.findRegionById(id);
  }

  async deleteRegion(id) {
    await this.#run('DELETE FROM regions WHERE id = ?', [id]);
  }

  // ---------------------------------------------------------------
  // Cities
  // ---------------------------------------------------------------

  async listCities({ regionId } = {}) {
    const [rows] = await this.#run(
      regionId
        ? 'SELECT id, region_id, name, slug, latitude, longitude FROM cities WHERE region_id = ? ORDER BY name ASC'
        : 'SELECT id, region_id, name, slug, latitude, longitude FROM cities ORDER BY name ASC',
      regionId ? [regionId] : [],
    );
    return rows.map(toCityDomain);
  }

  async findCityById(id) {
    const [rows] = await this.#run(
      'SELECT id, region_id, name, slug, latitude, longitude FROM cities WHERE id = ?',
      [id],
    );
    return rows[0] ? toCityDomain(rows[0]) : null;
  }

  async createCity({ regionId, name, slug, latitude, longitude }) {
    const [result] = await this.#run(
      'INSERT INTO cities (region_id, name, slug, latitude, longitude) VALUES (?, ?, ?, ?, ?)',
      [regionId, name, slug, latitude ?? null, longitude ?? null],
    );
    return this.findCityById(result.insertId);
  }

  async updateCity(id, { regionId, name, slug, latitude, longitude }) {
    await this.#run(
      'UPDATE cities SET region_id = ?, name = ?, slug = ?, latitude = ?, longitude = ? WHERE id = ?',
      [regionId, name, slug, latitude ?? null, longitude ?? null, id],
    );
    return this.findCityById(id);
  }

  async deleteCity(id) {
    await this.#run('DELETE FROM cities WHERE id = ?', [id]);
  }
}

export default MySqlMarketplaceConfigRepository;
