import logger from "$lib/logger";
import type { TTenant } from "$lib/types/tenant";
import { changeTenantUsingApi } from "$lib/utils/tenants";
import { toast } from "svelte-sonner";
import { writable } from "svelte/store";
import { auth } from "./auth";
import { m } from "$i18n/messages";

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
    setCurrentTenant: (tenantId: string | null, updateApi: boolean = true) => {
      if (updateApi) {
        const success = changeTenantUsingApi(tenantId);
        if (!success) {
          log.error("Failed to change tenant via API", { tenantId });
          toast.error(m["tenants.failedToSwitch"]());
          return;
        }
      }

      store.update((state) => {
        const currentTenant = state.tenants.find((t) => t.id === tenantId) || null;
        auth.setTenantId(tenantId);
        return { ...state, currentTenant };
      });
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

        store.update((state) => {
          return { ...state, tenants, isLoading: false };
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
