import { browser } from "$app/environment";
import { goto } from "$app/navigation";
import { resolve } from "$app/paths";
import type { SupportedLocale } from "$lib/const/locales";
import { ROUTES } from "$lib/const/routes";
import type { UserRole } from "$lib/server/auth/authorization-service";
import { get, writable } from "svelte/store";

export interface PasskeyAuthData {
  authenticatorData: string;
  passkeyId: string;
  email: string;
  prfOutput?: string; // Base64-encoded PRF output for staff crypto key derivation
}

export interface AuthState {
  isAuthenticated: boolean;
  refreshPromise: Promise<Response> | null;
  user?: AuthStateUser;
  passkeyAuthData?: PasskeyAuthData;
  lastActive?: Date | undefined;
  isInactive?: boolean;
}

export type AuthStateUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  language: SupportedLocale;
  // The currently selected tenant
  tenantId?: string | null;
};

function createAuthStore() {
  const store = writable<AuthState>({
    isAuthenticated: false,
    refreshPromise: null,
    isInactive: false,
  });

  return {
    ...store,
    setAuthenticated: (isAuthenticated: boolean) => {
      store.update((state) => ({ ...state, isAuthenticated }));
    },
    setRefreshPromise: (promise: Promise<Response> | null) => {
      store.update((state) => ({ ...state, refreshPromise: promise }));
    },
    setUser: (user: AuthState["user"]) => {
      store.update((state) => ({ ...state, isAuthenticated: true, user }));

      if (browser && user) {
        const storageItem = sessionStorage.getItem("passkeyAuthData");
        if (storageItem) {
          const passkeyAuthData: PasskeyAuthData = JSON.parse(storageItem);
          store.update((state) => ({ ...state, passkeyAuthData }));
        }
      }
    },
    setTenantId: (tenantId: string | null) => {
      store.update((state) => {
        if (!state.user) return state;
        return { ...state, user: { ...state.user, tenantId } };
      });
    },
    reset: () => {
      store.set({
        isAuthenticated: false,
        refreshPromise: null,
        user: undefined,
        passkeyAuthData: undefined,
        lastActive: undefined,
      });
    },
    setPasskeyAuthData: (data: PasskeyAuthData) => {
      store.update((state) => ({ ...state, passkeyAuthData: data }));
      sessionStorage.setItem("passkeyAuthData", JSON.stringify(data));
    },
    getPasskeyAuthData: (): PasskeyAuthData | undefined => {
      let authState: AuthState;
      const unsubscribe = store.subscribe((state) => {
        authState = state;
      });
      unsubscribe();
      return authState!.passkeyAuthData;
    },
    clearPasskeyAuthData: () => {
      store.update((state) => ({ ...state, passkeyAuthData: undefined }));
      sessionStorage.removeItem("passkeyAuthData");
    },
    isAuthenticated: () => {
      let authState: AuthState;
      const unsubscribe = store.subscribe((state) => {
        authState = state;
      });
      unsubscribe();
      return authState!.isAuthenticated;
    },
    getTenant: () => {
      let authState: AuthState;
      const unsubscribe = store.subscribe((state) => {
        authState = state;
      });
      unsubscribe();
      return authState!.user?.tenantId || null;
    },
    refreshLastActive: () => {
      store.update((state) => ({ ...state, lastActive: new Date(), isInactive: false }));
    },
    checkLastActive: async () => {
      // Wait for a little bit to avoid false positives right after login
      await new Promise((resolve) => setTimeout(resolve, 200));

      const lastActive = get(store).lastActive;
      if (!lastActive) return;

      const now = new Date();
      const diff = now.getTime() - lastActive.getTime();

      // Logs user out after 15 minutes of inactivity
      if (diff > 15 * 60 * 1000) {
        goto(resolve(ROUTES.LOGOUT));
      }

      // Triggers inactivity modal after 10 minutes
      if (diff > 10 * 60 * 1000) {
        store.update((state) => ({ ...state, isInactive: true }));
      }
    },
    waitForRefresh: async () => {
      let authState: AuthState;
      const unsubscribe = store.subscribe((state) => {
        authState = state;
      });
      unsubscribe();

      if (authState!.refreshPromise) {
        await authState!.refreshPromise;
      }
    },
  };
}

export const auth = createAuthStore();
