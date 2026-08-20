import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updatePartnerStaffRole } from '../../../api/partners.js';
import partnerKeys from '../constants/queryKeys.js';

export function useUpdateStaffRoleMutation(partnerId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ employeeId, roleCode }) =>
      updatePartnerStaffRole(partnerId, employeeId, roleCode),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: partnerKeys.staff(partnerId) });
    },
  });
}

export default useUpdateStaffRoleMutation;
