import { browser } from "$app/environment";
import type { TAgent } from "$lib/types/agent";
import { writable } from "svelte/store";
import { auth } from "./auth";

interface AgentsState {
  agents: TAgent[];
  isLoading: boolean;
}

const createAgentsStore = () => {
  const store = writable<AgentsState>({
    agents: [],
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
        const res = await fetch(`/api/tenants/${tenantId}/agents`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "same-origin",
        });

        const body = await res.json();
        const agents = body.agents ?? ([] as TAgent[]);

        store.update((state) => {
          return { ...state, agents, isLoading: false };
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

export const agents = createAgentsStore();
