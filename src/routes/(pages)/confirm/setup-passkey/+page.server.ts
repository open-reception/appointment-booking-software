import { fail } from "@sveltejs/kit";
import { superValidate } from "sveltekit-superforms";
import { zod } from "sveltekit-superforms/adapters";
import type { Actions, PageServerLoad } from "./$types";
import { formSchema } from "./schema";
import logger from "$lib/logger";
import { base64ToArrayBuffer, getCounterFromAuthenticatorData } from "$lib/utils/passkey";

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

    const authenticatorData = base64ToArrayBuffer(form.data.authenticatorDataBase64);
    const counter = getCounterFromAuthenticatorData(authenticatorData);
    const resp = await event.fetch(`/api/auth/register/${form.data.userId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: form.data.id,
        email: form.data.email,
        passkey: {
          id: form.data.id,
          publicKey: form.data.publicKeyBase64,
          deviceName: "Unkown Device",
          counter,
          response: {
            authenticatorData: form.data.authenticatorDataBase64,
          },
        },
        counter,
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
