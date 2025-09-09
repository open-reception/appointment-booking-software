import { browser } from "$app/environment";
import { getCookie } from "$lib/utils/cookies";
import { writable } from "svelte/store";

interface AuthState {
  isOpen: boolean;
  isEducated: boolean;
}

export const SIDEBAR_OPEN_STORAGE_KEY = "sidebar-is-open";
export const SIDEBAR_EDUCATION_STORAGE_KEY = "sidebar-is-educated";

function createSidebarStore() {
  const isOpenValue = browser ? getCookie(SIDEBAR_OPEN_STORAGE_KEY) : null;
  const isEducatedValue = browser ? getCookie(SIDEBAR_EDUCATION_STORAGE_KEY) : null;
  console.log("isEducatedValue", isEducatedValue);
  const store = writable<AuthState>({
    isOpen: isOpenValue === "true" ? true : false,
    isEducated: isEducatedValue === "true" ? true : false,
  });

  return {
    ...store,
    setOpen: (isOpen: boolean) => {
      if (browser) {
        document.cookie = `${SIDEBAR_OPEN_STORAGE_KEY}=${isOpen}; path=/; max-age=604800`;
      }
      store.update((state) => ({ ...state, isOpen }));
    },
    setEducated: (isEducated: boolean, isFinal?: boolean) => {
      if (browser && isFinal) {
        document.cookie = `${SIDEBAR_EDUCATION_STORAGE_KEY}=${isEducated}; path=/; max-age=604800`;
      }
      store.update((state) => ({ ...state, isEducated }));
    },
  };
}

export const sidebar = createSidebarStore();
