import logger from "$lib/logger";
import type { PageServerLoad } from "./$types";

const log = logger.setContext(import.meta.filename);

type Error = { success: false; isSetup: boolean };
type Success = {
  success: boolean;
  isSetup: boolean;
  id: string;
  email: string;
  tenantId: string | null;
};
export const load: PageServerLoad = async (event) => {
  const confirmation: Promise<Success | Error> = event
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
        return {
          success,
          isSetup: body.isSetup ?? false,
          id: body.id,
          email: body.email,
          tenantId: body.tenantId,
        };
      } catch (error) {
        log.error("Failed to parse confirm token response", { error });
        return { success: false, isSetup: false };
      }
    });

  return {
    streaming: {
      confirmation,
    },
  };
};
