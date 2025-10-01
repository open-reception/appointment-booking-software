import type { UserRole } from "$lib/server/auth/authorization-service";
import { writable } from "svelte/store";

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
      });
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
