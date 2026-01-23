import { fail } from "@sveltejs/kit";
import { superValidate } from "sveltekit-superforms";
import { zod4 as zod } from "sveltekit-superforms/adapters";
import type { Actions, PageServerLoad } from "./$types";
import { formSchema } from "./schema";
import logger from "$lib/logger";

const log = logger.setContext(import.meta.filename);

export const load: PageServerLoad = async () => {
  return {
    form: await superValidate(zod(formSchema)),
  };
};

export const actions: Actions = {
  default: async (event) => {
    const form = await superValidate(event, zod(formSchema));

    if (!form.valid) {
      log.error("Setup passkey form is not valid", { errors: form.errors });
      return fail(400, {
        form,
      });
    }

    const resp = await event.fetch(`/api/auth/register/${form.data.userId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: form.data.email,
        challenge: form.data.challenge, // Send original registration challenge
        passkey: {
          id: form.data.id,
          attestationObject: form.data.attestationObjectBase64,
          clientDataJSON: form.data.clientDataJSONBase64,
          deviceName: "Unknown Device",
        },
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
        log.error("Failed to parse setup passkey error response", { error: e });
      }
      return fail(400, {
        form: { ...form, data: { ...form.data } },
        error,
      });
    }
  },
};
