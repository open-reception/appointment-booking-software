import { browser } from "$app/environment";
import type { TStaff } from "$lib/types/staff";
import { writable } from "svelte/store";
import { auth } from "./auth";

interface StaffState {
  staff: TStaff[];
  isLoading: boolean;
}

const createStaffStore = () => {
  const store = writable<StaffState>({
    staff: [],
    isLoading: false,
  });

  return {
    ...store,
    load: async () => {
      if (!browser) return;

      store.update((state) => {
        return { ...state, isLoading: true };
      });

      try {
        const tenantId = auth.getTenant();
        const res = await fetch(`/api/tenants/${tenantId}/staff`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "same-origin",
        });

        const body = await res.json();
        const staff = body.staff ?? ([] as TStaff[]);

        store.update((state) => {
          return { ...state, staff, isLoading: false };
        });
      } catch (error) {
        store.update((state) => {
          return { ...state, isLoading: false };
        });
        console.error("Failed to parse agents response", { error });
      }
    },
  };
};

export const staff = createStaffStore();
