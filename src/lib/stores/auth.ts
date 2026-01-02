import { browser } from "$app/environment";
import type { UserRole } from "$lib/server/auth/authorization-service";
import { writable } from "svelte/store";

export interface PasskeyAuthData {
  authenticatorData: string;
  passkeyId: string;
  email: string;
  prfOutput?: string; // Base64-encoded PRF output for staff crypto key derivation
}

export interface AuthState {
  isAuthenticated: boolean;
  isRefreshing: boolean;
  user?: {
    id: string;
    email: string;
    name: string;
    role: UserRole;
    // The currently selected tenant
    tenantId?: string | null;
  };
  passkeyAuthData?: PasskeyAuthData;
}

function createAuthStore() {
  const store = writable<AuthState>({
    isAuthenticated: false,
    isRefreshing: false,
  });

  return {
    ...store,
    setRefreshing: (isRefreshing: boolean) => {
      store.update((state) => ({ ...state, isRefreshing }));
    },
    setAuthenticated: (isAuthenticated: boolean) => {
      store.update((state) => ({ ...state, isAuthenticated }));
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
        isRefreshing: false,
        user: undefined,
        passkeyAuthData: undefined,
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
  };
}

export const auth = createAuthStore();
