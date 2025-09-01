import { browser } from "$app/environment";
import { writable } from "svelte/store";

interface AuthState {
	isOpen: boolean;
}

const LOCAL_STORAGE_KEY = "sidebar-is-open";

function createSidebarStore() {
	const storedValue = browser ? localStorage.getItem(LOCAL_STORAGE_KEY) : null;
	const store = writable<AuthState>({
		isOpen: storedValue === "true" ? true : false
	});

	return {
		...store,
		setOpen: (isOpen: boolean) => {
			localStorage.setItem(LOCAL_STORAGE_KEY, `${isOpen}`);
			store.update((state) => ({ ...state, isOpen }));
		}
	};
}

export const sidebar = createSidebarStore();
