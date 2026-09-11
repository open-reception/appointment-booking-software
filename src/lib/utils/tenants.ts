import { SETUP_STATES_LIST } from "$lib/const/tenants";
import type { TTenant, TTenantFeatureFlag } from "$lib/types/tenant";
import { get } from "svelte/store";
import { tenants } from "$lib/stores/tenants";

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

export const hasFeatureFlag = (flag: TTenantFeatureFlag): boolean => {
  const curTenant = get(tenants).currentTenant;
  if (!curTenant) return false;

  return curTenant.features.includes(flag) || false;
};
