import { SETUP_STATES_LIST } from "$lib/const/tenants";
import type { TTenant, TTenantFeatureFlag } from "$lib/types/tenant";
import { get } from "svelte/store";
import { tenants } from "$lib/stores/tenants";
import { publicStore } from "$lib/stores/public";

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
  // Try dashboard
  const curTenant = get(tenants).currentTenant;
  if (curTenant) {
    return curTenant.features.includes(flag) || false;
  }

  // Try public site
  const publicTenant = get(publicStore).tenant;
  if (publicTenant) {
    return publicTenant.features.includes(flag) || false;
  }

  return false;
};
