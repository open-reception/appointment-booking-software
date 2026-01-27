import { browser } from "$app/environment";
import { writable } from "svelte/store";
import { auth } from "./auth";
import type { TNotification } from "$lib/types/notification";

interface NotificationState {
  notifications: TNotification[];
  isLoading: boolean;
}

const createNotificationsStore = () => {
  const store = writable<NotificationState>({
    notifications: [],
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
        const res = await fetch(`/api/tenants/${tenantId}/notifications`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "same-origin",
        });

        const body = await res.json();
        const notifications = body.notifications ?? ([] as TNotification[]);

        store.update((state) => {
          return { ...state, notifications, isLoading: false };
        });
      } catch (error) {
        store.update((state) => {
          return { ...state, isLoading: false };
        });
        console.error("Failed to parse notifications response", { error });
      }
    },
    deleteAll: async () => {
      if (!browser) return;

      store.update((state) => {
        return { ...state, isLoading: true };
      });

      try {
        const tenantId = auth.getTenant();
        const res = await fetch(`/api/tenants/${tenantId}/notifications`, {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "same-origin",
        });

        store.update((state) => {
          return { ...state, isLoading: false };
        });

        if (res.status < 400) {
          // Trigger load to refresh notifications
          notifications.load();

          return true;
        } else {
          return false;
        }
      } catch (error) {
        store.update((state) => {
          return { ...state, isLoading: false };
        });
        console.error("Failed to parse notifications response", { error });
      }
    },
    delete: async (notificationId: string) => {
      if (!browser) return;

      store.update((state) => {
        return { ...state, isLoading: true };
      });

      try {
        const tenantId = auth.getTenant();
        const res = await fetch(`/api/tenants/${tenantId}/notifications/${notificationId}`, {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "same-origin",
        });

        store.update((state) => {
          return { ...state, isLoading: false };
        });

        if (res.status < 400) {
          // Trigger load to refresh notifications
          notifications.load();

          return true;
        } else {
          return false;
        }
      } catch (error) {
        store.update((state) => {
          return { ...state, isLoading: false };
        });
        console.error("Failed to parse notifications response", { error });
      }
    },
  };
};

export const notifications = createNotificationsStore();
