/**
 * Auth module response DTOs (BACKEND_ARCHITECTURE.md Ch.9).
 *
 * `password_hash` is a `UserRecord` field that must never cross this
 * boundary — `toUserDto` is the one place that shapes a domain User into
 * what the wire format is allowed to contain.
 */

export function toUserDto(user) {
  return {
    id: user.id,
    email: user.email,
    first_name: user.firstName,
    last_name: user.lastName,
    phone: user.phone,
    avatar_media_id: user.avatarMediaId,
    is_email_verified: user.isEmailVerified,
    is_phone_verified: user.isPhoneVerified,
    created_at: user.createdAt,
    updated_at: user.updatedAt,
  };
}

export function toAuthResponseDto({ user, accessToken, refreshToken }) {
  return {
    user: toUserDto(user),
    access_token: accessToken,
    refresh_token: refreshToken,
  };
}

export function toPrincipalDto({ user, roles, permissions }) {
  return {
    user: toUserDto(user),
    roles,
    permissions,
  };
}
