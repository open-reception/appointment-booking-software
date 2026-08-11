import logger from "$lib/logger";
import type { TStaffKeyShare } from "$lib/types/staff";

export const getStaffKeyShares = async (
  tenantId: string,
  tunnelId: string,
): Promise<TStaffKeyShare[]> => {
  const resp = await fetch(
    `/api/tenants/${tenantId}/appointments/tunnels/${tunnelId}/staff-key-shares`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    },
  );

  let data;
  try {
    data = await resp.json();
  } catch (error) {
    logger.error("Failed to parse staff key shares response", { tenantId, tunnelId, error });
  }

  return data?.keyShares || [];
};
