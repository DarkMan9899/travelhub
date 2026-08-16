/**
 * `useAdminConfigResource` — Stage 11.5 (Marketplace Configuration).
 *
 * The six lookup entities on the Marketplace Configuration page
 * (categories, amenities, pricing models, countries, regions, cities)
 * are structurally identical CRUD panels — list + create + update +
 * delete, no pagination (every one of these tables is small by design).
 * Rather than hand-write six near-duplicate query/mutation hook files
 * (the convention every other admin module uses for genuinely distinct
 * entities), this one generic factory is instantiated per entity
 * directly inside `AdminMarketplaceConfigPageContent` — these hooks are
 * not reused anywhere else in the app, unlike e.g. `useAdminUsersQuery`.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export function useAdminConfigResource({
  queryKey,
  list,
  create,
  update,
  remove,
}) {
  const queryClient = useQueryClient();

  const listQuery = useQuery({
    queryKey,
    queryFn: () => list().then((response) => response.data),
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey });
  }

  const createMutation = useMutation({
    mutationFn: (payload) => create(payload),
    onSuccess: invalidate,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...payload }) => update(id, payload),
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => remove(id),
    onSuccess: invalidate,
  });

  return {
    listQuery,
    createMutation,
    updateMutation,
    deleteMutation,
  };
}

export default useAdminConfigResource;
