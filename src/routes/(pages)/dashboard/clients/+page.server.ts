import { ROUTES } from "$lib/const/routes.js";
import logger from "$lib/logger";
import { fail, redirect, type Actions } from "@sveltejs/kit";
import { superValidate } from "sveltekit-superforms";
import { zod4 as zod } from "sveltekit-superforms/adapters";
import { formSchema as resetPinSchema } from "./(components)/reset-pin-form";

const log = logger.setContext(import.meta.filename);

export const actions: Actions = {
  pinReset: async (event) => {
    const form = await superValidate(event, zod(resetPinSchema));

    if (!form.valid) {
      log.error("Reset PIN form is not valid", { errors: form.errors });
      return fail(400, {
        form: { ...form, data: { ...form.data } },
        error: "Form is not valid",
      });
    }

    if (!event.locals.user?.tenantId) {
      log.error("User trying to reset PIN, but has no tenantId");
      redirect(302, ROUTES.LOGOUT);
    }

    const resp = await event.fetch(`/api/tenants/${form.data.tenant}/clients/pin-reset/request`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "same-origin",
      body: JSON.stringify({
        email: form.data.email,
        emailHash: form.data.hashedEmail,
        clientLanguage: form.data.language,
      }),
    });

    if (resp.status < 400) {
      return { form };
    } else {
      let error = "Unknown error";
      try {
        const body = await resp.json();
        error = body.error;
      } catch (e) {
        log.error("Failed to parse pin reset error response", { error: e });
      }
      return fail(resp.status, {
        form,
        error,
      });
    }
  },
};
