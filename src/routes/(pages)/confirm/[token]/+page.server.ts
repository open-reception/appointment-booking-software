import logger from "$lib/logger";
import type { PageServerLoad } from "./$types";

const log = logger.setContext("/confirm/{token}/+page.server.ts");

export const load: PageServerLoad = async (event) => {
  const confirmation: Promise<{ success: boolean; isSetup: boolean }> = event
    .fetch("/api/auth/confirm", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ token: event.params.token }),
    })
    .then(async (resp) => {
      const success = resp.status < 400;
      try {
        const body = await resp.json();
        const isSetup = body.isSetup ?? false;
        return { success, isSetup };
      } catch (error) {
        log.error("Failed to parse confirm token response", { error });
        return { success, isSetup: false };
      }
    });

  return {
    streaming: {
      confirmation,
    },
  };
};
