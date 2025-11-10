import logger from "$lib/logger";
import type { TPublicChannel, TPublicTenant } from "$lib/types/public";
import type { LayoutServerLoad } from "./$types";

const log = logger.setContext(import.meta.filename);

export const load: LayoutServerLoad = async (event) => {
  const tenant = event
    .fetch(`/api/public`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "same-origin",
    })
    .then(async (res) => {
      try {
        const body = await res.json();
        return body.tenant as TPublicTenant;
      } catch (error) {
        log.error("Failed to parse settings base response", { error });
      }
    });

  const channels = event
    .fetch(`/api/public/channels`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "same-origin",
    })
    .then(async (res) => {
      try {
        const body = await res.json();
        return body.channels || ([] as TPublicChannel[]);
      } catch (error) {
        log.error("Failed to parse settings base response", { error });
      }
    });

  return {
    streaming: { tenant, channels },
  };
};
