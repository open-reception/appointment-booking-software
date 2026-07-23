import { ROUTES } from "$lib/const/routes.js";
import logger from "$lib/logger";
import type { RedactedPasskey, RedactedPasskeyHydrated } from "$lib/types/passkeys.js";
import { redirect } from "@sveltejs/kit";

const log = logger.setContext(import.meta.filename);

export const load = async (event) => {
  const tenantId = event.locals.user?.tenantId;
  event.depends(`app:passkeys-${tenantId}`);

  if (!tenantId) {
    log.error("User trying to access their passkeys, but has no tenantId");
    redirect(302, ROUTES.LOGOUT);
  }

  const list = event
    .fetch(`/api/auth/passkeys`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "same-origin",
    })
    .then(async (res) => {
      // Logout if session expired
      if (res.status === 401) {
        redirect(302, ROUTES.LOGOUT);
      }

      try {
        const body = await res.json();
        return body.passkeys.map((it: RedactedPasskey) => ({
          ...it,
          createdAt: it.createdAt ? new Date(it.createdAt) : null,
          lastUsedAt: it.lastUsedAt ? new Date(it.lastUsedAt) : null,
        })) as RedactedPasskeyHydrated[];
      } catch (error) {
        log.error("Failed to parse user passkeys response", { error });
        return [];
      }
    });

  return {
    streamed: {
      list,
    },
  };
};
