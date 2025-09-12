import { fail } from "@sveltejs/kit";
import { superValidate } from "sveltekit-superforms";
import { zod } from "sveltekit-superforms/adapters";
import type { Actions, PageServerLoad } from "./$types";
import { formSchema } from "./schema";
import logger from "$lib/logger";

const log = logger.setContext("/confirm/resend/+page.server.ts");

export const load: PageServerLoad = async () => {
  return {
    form: await superValidate(zod(formSchema)),
  };
};

export const actions: Actions = {
  default: async (event) => {
    const form = await superValidate(event, zod(formSchema));

    if (!form.valid) {
      log.error("Resend confirmation email form is not valid", { errors: form.errors });
      return fail(400, {
        form,
      });
    }

    await event.fetch("/api/auth/resend-confirmation", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email: form.data.email }),
    });

    return { form };
  },
};
