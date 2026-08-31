import logger from "$lib/logger";
import { fail, type Actions } from "@sveltejs/kit";
import { superValidate } from "sveltekit-superforms";
import { zod4 as zod } from "sveltekit-superforms/adapters";
import { formSchema as editFormSchema } from "./(components)/change-passphrase-form";

const log = logger.setContext(import.meta.filename);

export const actions: Actions = {
  edit: async (event) => {
    const form = await superValidate(event, zod(editFormSchema));

    if (!form.valid) {
      log.error("Edit account settings form is not valid", { errors: form.errors });
      return fail(400, {
        form: { ...form, data: { ...form.data } },
        error: "Form is not valid",
      });
    }

    const resp = await event.fetch(`/api/me/passphrase`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "same-origin",
      body: JSON.stringify({
        passphrase: form.data.passphrase,
        newPassphrase: form.data.newPassphrase,
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
        log.error("Failed to parse edit account settings error response", { error: e });
      }
      return fail(resp.status, {
        form: { ...form, data: { ...form.data } },
        error,
      });
    }
  },
};
