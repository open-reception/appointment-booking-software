import { browser } from "$app/environment";
import { getCookie } from "$lib/utils/cookies";
import { writable } from "svelte/store";

interface AuthState {
  isOpen: boolean;
}

export const STORAGE_KEY = "sidebar-is-open";

function createSidebarStore() {
  const storedValue = browser ? getCookie(STORAGE_KEY) : null;
  const store = writable<AuthState>({
    isOpen: storedValue === "true" ? true : false,
  });

  return {
    ...store,
    setOpen: (isOpen: boolean) => {
      if (browser) {
        document.cookie = `${STORAGE_KEY}=${isOpen}; path=/; max-age=604800`;
      }
      store.update((state) => ({ ...state, isOpen }));
    },
  };
}

export const sidebar = createSidebarStore();
