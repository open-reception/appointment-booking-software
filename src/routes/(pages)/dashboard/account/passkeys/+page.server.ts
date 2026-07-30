import { ROUTES } from "$lib/const/routes.js";
import logger from "$lib/logger";
import type { RedactedPasskey, RedactedPasskeyHydrated } from "$lib/types/passkeys.js";
import { fail, redirect, type Actions } from "@sveltejs/kit";
import { superValidate } from "sveltekit-superforms";
import { zod4 as zod } from "sveltekit-superforms/adapters";
import { formSchema as editFormSchema } from "./(components)/edit-passkey-form";

const log = logger.setContext(import.meta.filename);

export const load = async (event) => {
  event.depends(`app:account-passkeys`);

  const user = event.locals.user;
  if (!user) {
    log.error("User trying to access their passkeys, but has no user");
    redirect(302, ROUTES.LOGOUT);
  }

  const list = event
    .fetch(`/api/auth/passkeys`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "same-origin",
    })
    .then(async (res) => {
      // Logout if session expired
      if (res.status === 401) {
        redirect(302, ROUTES.LOGOUT);
      }

      try {
        const body = await res.json();
        return body.passkeys.map((it: RedactedPasskey) => ({
          ...it,
          createdAt: it.createdAt ? new Date(it.createdAt) : null,
          lastUsedAt: it.lastUsedAt ? new Date(it.lastUsedAt) : null,
        })) as RedactedPasskeyHydrated[];
      } catch (error) {
        log.error("Failed to parse user passkeys response", { error });
        return [];
      }
    });

  return {
    passkeyId: user.passkeyId,
    streamed: {
      list,
    },
  };
};

export const actions: Actions = {
  edit: async (event) => {
    const form = await superValidate(event, zod(editFormSchema));

    if (!form.valid) {
      log.error("Edit passkey form is not valid", { errors: form.errors });
      return fail(400, {
        form: { ...form, data: { ...form.data } },
        error: "Form is not valid",
      });
    }

    if (!form.data.passkeyId) {
      log.error("User trying to edit a passkey, but has no passkeyId");
      redirect(302, ROUTES.LOGOUT);
    }

    const resp = await event.fetch(`/api/auth/passkeys/${form.data.passkeyId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "same-origin",
      body: JSON.stringify({
        deviceName: form.data.deviceName,
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
        log.error("Failed to parse edit passkey error response", { error: e });
      }
      return fail(400, {
        form: { ...form, data: { ...form.data } },
        error,
      });
    }
  },
};
