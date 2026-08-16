/**
 * Settings module response DTOs — Stage 11.9 Admin Platform.
 */

export function toSettingResponse(setting) {
  return {
    id: setting.id,
    key: setting.key,
    value: setting.value,
    description: setting.description,
    updated_by: setting.updatedBy,
    updated_at: setting.updatedAt,
  };
}

export function toFeatureFlagResponse(flag) {
  return {
    id: flag.id,
    code: flag.code,
    name: flag.name,
    description: flag.description,
    is_enabled: flag.isEnabled,
    updated_at: flag.updatedAt,
  };
}

export default { toSettingResponse, toFeatureFlagResponse };
