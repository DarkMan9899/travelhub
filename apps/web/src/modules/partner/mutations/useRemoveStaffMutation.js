import { useMutation, useQueryClient } from '@tanstack/react-query';
import { removePartnerStaff } from '../../../api/partners.js';
import partnerKeys from '../constants/queryKeys.js';

export function useRemoveStaffMutation(partnerId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (employeeId) => removePartnerStaff(partnerId, employeeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: partnerKeys.staff(partnerId) });
    },
  });
}

export default useRemoveStaffMutation;
