/** AI memory response DTOs (Phase 15). */

export function toMemoryEntryResponse(entry) {
  return {
    key: entry.key,
    value: entry.value,
    updated_at: entry.updatedAt,
  };
}

export function toMemoryListResponse(entries) {
  return entries.map(toMemoryEntryResponse);
}
