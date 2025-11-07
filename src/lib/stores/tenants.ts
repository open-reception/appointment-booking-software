import logger from "$lib/logger";
import type { TTenant } from "$lib/types/tenant";
import { changeTenantUsingApi } from "$lib/utils/tenants";
import { toast } from "svelte-sonner";
import { writable } from "svelte/store";
import { auth } from "./auth";
import { m } from "$i18n/messages";
import { goto } from "$app/navigation";
import { ROUTES } from "$lib/const/routes";
import { agents } from "./agents";
import { channels } from "./channels";

const log = logger.setContext("TenantsStore");

interface TenantState {
  tenants: TTenant[];
  isLoading: boolean;
  currentTenant: TTenant | null;
}

const createTenantsStore = () => {
  const store = writable<TenantState>({
    tenants: [],
    isLoading: true,
    currentTenant: null,
  });

  return {
    ...store,
    init: (tenants: TTenant[]) => {
      store.set({ tenants, isLoading: false, currentTenant: null });
    },
    setCurrentTenant: (tenantId: string | null) => {
      const curTenant = auth.getTenant();

      // Switch tenant on api level
      if (tenantId !== curTenant) {
        const success = changeTenantUsingApi(tenantId);
        if (!success) {
          log.error("Failed to change tenant via API", { tenantId });
          toast.error(m["tenants.failedToSwitch"]());
          return;
        }
      }

      // Update store
      store.update((state) => {
        const currentTenant = state.tenants.find((t) => t.id === tenantId) || null;
        auth.setTenantId(tenantId);
        return { ...state, currentTenant };
      });
      agents.load();
      channels.load();

      // Redirect to dashboard main if tenant changed to avaoid showing data from previous tenant
      if (tenantId !== curTenant) {
        goto(ROUTES.DASHBOARD.MAIN);
      }
    },
    reload: async () => {
      store.update((state) => {
        return { ...state, isLoading: true };
      });
      try {
        const res = await fetch(`/api/tenants`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "same-origin",
        });

        const body = await res.json();
        const tenants = body.tenants ?? ([] as TTenant[]);
        const newCurrentTenantId = auth.getTenant();

        store.update((state) => {
          return {
            ...state,
            tenants,
            isLoading: false,
            currentTenant: tenants.find((t: TTenant) => t.id === newCurrentTenantId) || null,
          };
        });
      } catch (error) {
        store.update((state) => {
          return { ...state, isLoading: false };
        });
        console.error("Failed to parse tenants response", { error });
      }
    },
  };
};

export const tenants = createTenantsStore();
