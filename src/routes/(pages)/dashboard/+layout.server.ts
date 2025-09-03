import { auth, type AuthState } from "$lib/stores/auth";
import { sidebar, STORAGE_KEY } from "$lib/stores/sidebar";
import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = async (event) => {
  // Initialize sidebar state from cookies for ssr
  const isOpen = event.cookies.get(STORAGE_KEY);
  sidebar.setOpen(isOpen === "true" ? true : false);

  // Initialize auth state from locals for ssr
  let user: AuthState["user"] | null = null;
  if (event.locals.user) {
    user = {
      id: event.locals.user.userId,
      name: event.locals.user.name,
      email: event.locals.user.email,
      role: event.locals.user.role,
      tenantId: event.locals.user.tenantId,
    };
    auth.setUser(user);
  }

  return {
    user,
  };
};
