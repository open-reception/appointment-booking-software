import { SETUP_STATES_LIST } from "$lib/const/tenants";
import type { TTenant } from "$lib/types/tenant";

export const changeTenantUsingApi = async (tenantId: string | null): Promise<boolean> => {
  const response = await fetch("/api/admin/tenant", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "same-origin",
    body: JSON.stringify({ tenantId }),
  });

  if (!response.ok && response.status < 300) {
    return true;
  }

  return false;
};

export const isSetupStateDone = (tenant: TTenant, step: TTenant["setupState"]): boolean => {
  const curStateIndex = SETUP_STATES_LIST.indexOf(tenant.setupState);
  const stepIndex = SETUP_STATES_LIST.indexOf(step);
  return curStateIndex > stepIndex;
};
