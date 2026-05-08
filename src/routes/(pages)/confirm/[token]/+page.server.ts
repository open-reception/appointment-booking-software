import logger from "$lib/logger";
import { removeAuthCookies } from "$lib/server/utils/cookies";
import { generateRegistrationBootstrapToken } from "$lib/server/auth/registration-bootstrap";
import type { PageServerLoad } from "./$types";

const log = logger.setContext(import.meta.filename);

type Error = { success: false; isSetup: boolean };
type Success = {
  success: true;
  isSetup: boolean;
  id: string;
  email: string;
  tenantId: string | null;
};
export const load: PageServerLoad = async (event) => {
  // Remove any existing access token cookie
  removeAuthCookies(event);

  const resp = await event.fetch("/api/auth/confirm", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ token: event.params.token }),
  });

  const success = resp.status < 400;
  try {
    const rawBody = await resp.text();
    const body = rawBody ? JSON.parse(rawBody) : {};

    if (success && typeof body.id === "string" && typeof body.email === "string") {
      const registrationBootstrapToken = await generateRegistrationBootstrapToken({
        userId: body.id,
        email: body.email,
      });

      if (registrationBootstrapToken) {
        event.cookies.set("webauthn-registration-bootstrap", registrationBootstrapToken, {
          httpOnly: true,
          secure: true,
          sameSite: "strict",
          path: "/",
          maxAge: 60 * 15,
        });
      }

      return {
        confirmation: {
          success: true,
          isSetup: body.isSetup ?? false,
          id: body.id,
          email: body.email,
          tenantId: body.tenantId ?? null,
        } satisfies Success,
      };
    }

    return {
      confirmation: { success: false, isSetup: false } satisfies Error,
    };
  } catch (error) {
    log.error("Failed to parse confirm token response", {
      error,
      status: resp.status,
      contentType: resp.headers.get("content-type"),
    });
    return {
      confirmation: { success: false, isSetup: false } satisfies Error,
    };
  }
};
