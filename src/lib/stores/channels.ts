import { browser } from "$app/environment";
import { writable } from "svelte/store";
import { auth } from "./auth";
import type { TChannel } from "$lib/types/channel";

interface ChannelsState {
  channels: TChannel[];
  isLoading: boolean;
}

const createChannelsStore = () => {
  const store = writable<ChannelsState>({
    channels: [],
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
        const res = await fetch(`/api/tenants/${tenantId}/channels`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "same-origin",
        });

        const body = await res.json();
        const channels = body.channels ?? ([] as TChannel[]);

        store.update((state) => {
          return { ...state, channels, isLoading: false };
        });
      } catch (error) {
        store.update((state) => {
          return { ...state, isLoading: false };
        });
        console.error("Failed to parse channels response", { error });
      }
    },
  };
};

export const channels = createChannelsStore();
