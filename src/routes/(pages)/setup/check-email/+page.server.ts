import { superValidate } from "sveltekit-superforms";
import { zod4 as zod } from "sveltekit-superforms/adapters";
import type { Actions, PageServerLoad } from "./$types";
import { formSchema } from "./schema";
import { UserService } from "$lib/server/services/user-service";
import { fail } from "@sveltejs/kit";
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
      log.error("Resend confirmation email form is not valid", { errors: form.errors });
      return fail(400, {
        form,
      });
    }

    await UserService.resendConfirmationEmail(form.data.email, event.url);

    return {
      form,
    };
  },
};
