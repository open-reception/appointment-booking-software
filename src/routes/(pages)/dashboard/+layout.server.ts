import { auth, type AuthState } from "$lib/stores/auth";
import {
  sidebar,
  SIDEBAR_OPEN_STORAGE_KEY,
  SIDEBAR_EDUCATION_STORAGE_KEY,
} from "$lib/stores/sidebar";
import type { TTenant } from "$lib/types/tenant";
import type { LayoutServerLoad } from "./$types";
import logger from "$lib/logger";

const log = logger.setContext("/dashboard/+layout.server.ts");

export const load: LayoutServerLoad = async (event) => {
  // Initialize sidebar state from cookies for ssr
  const isOpen = event.cookies.get(SIDEBAR_OPEN_STORAGE_KEY);
  const isEducated = event.cookies.get(SIDEBAR_EDUCATION_STORAGE_KEY);
  sidebar.setOpen(isOpen === "true" ? true : false);
  sidebar.setEducated(isEducated === "true" ? true : false);

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

  // Load tenants
  const tenants: Promise<TTenant[]> = event
    .fetch(`/api/tenants`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "same-origin",
    })
    .then(async (res) => {
      try {
        const body = await res.json();
        return body.tenants ?? ([] as TTenant[]);
      } catch (error) {
        log.error("Failed to parse tenants response in", { error });
      }
    });

  return {
    user,
    tenants,
  };
};
