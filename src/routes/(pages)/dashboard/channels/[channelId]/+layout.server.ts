import { ROUTES } from "$lib/const/routes.js";
import logger from "$lib/logger";
import type { TChannelWithFullAgents } from "$lib/types/channel";
import { redirect } from "@sveltejs/kit";

const log = logger.setContext(import.meta.filename);

export const load = async (event) => {
  event.depends(`channel:details`);

  if (!event.locals.user?.tenantId) {
    log.error("User trying to access channel, but has no tenantId");
    redirect(302, ROUTES.LOGOUT);
  }

  const channelId = event.params.channelId;
  const channel = event
    .fetch(`/api/tenants/${event.locals.user?.tenantId}/channels/${channelId}`, {
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
        return body.channel as TChannelWithFullAgents;
      } catch (error) {
        log.error("Failed to parse channel detail response", { error });
      }
    });

  return {
    streamed: {
      channel,
    },
  };
};
