import { writable } from "svelte/store";

interface AuthState {
	isAuthenticated: boolean;
	isRefreshing: boolean;
	user?: {
		id: string;
		email: string;
		name: string;
		role: string;
		// The currently selected tenant
		tenantId?: string | null;
	};
}

function createAuthStore() {
	const store = writable<AuthState>({
		isAuthenticated: false,
		isRefreshing: false
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
		reset: () => {
			store.set({
				isAuthenticated: false,
				isRefreshing: false,
				user: undefined
			});
		}
	};
}

export const auth = createAuthStore();
