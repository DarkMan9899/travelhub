/**
 * Marketplace Configuration module response DTOs — Stage 11.5 Admin
 * Platform.
 */

export function toCategoryResponse(category) {
  return {
    id: category.id,
    parent_id: category.parentId,
    name: category.name,
    slug: category.slug,
  };
}

export function toAmenityResponse(amenity) {
  return {
    id: amenity.id,
    name: amenity.name,
    amenity_group_id: amenity.amenityGroupId,
    amenity_group_name: amenity.amenityGroupName,
  };
}

export function toAmenityGroupResponse(group) {
  return { id: group.id, code: group.code, name: group.name };
}

export function toPricingModelResponse(pricingModel) {
  return {
    id: pricingModel.id,
    code: pricingModel.code,
    name: pricingModel.name,
  };
}

export function toCountryResponse(country) {
  return { id: country.id, iso_code: country.isoCode, name: country.name };
}

export function toRegionResponse(region) {
  return { id: region.id, country_id: region.countryId, name: region.name };
}

export function toCityResponse(city) {
  return {
    id: city.id,
    region_id: city.regionId,
    name: city.name,
    slug: city.slug,
    latitude: city.latitude,
    longitude: city.longitude,
  };
}
