import { fail } from "@sveltejs/kit";
import { superValidate } from "sveltekit-superforms";
import { zod } from "sveltekit-superforms/adapters";
import type { Actions, PageServerLoad } from "./$types";
import { formSchema } from "./schema";
import type { WebAuthnCredential } from "$lib/server/auth/webauthn-service";
import type { TUser } from "$lib/types/user";
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
      log.error("Login form is not valid", { errors: form.errors });
      return fail(400, {
        form: { ...form, data: { ...form.data, type: "passkey" } },
      });
    }

    let body: { credential?: WebAuthnCredential; email: string; passphrase?: string } = {
      email: form.data.email,
    };
    if (form.data.type === "passphrase") {
      body = { ...body, passphrase: form.data.passphrase };
    }

    if (form.data.type === "passkey") {
      body = {
        ...body,
        credential: {
          id: form.data.id,
          response: {
            clientDataJSON: form.data.clientDataBase64,
            authenticatorData: form.data.authenticatorDataBase64,
            signature: form.data.signatureBase64,
          },
        },
      };
    }

    const resp = await event.fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      credentials: "same-origin",
    });

    let user: TUser | null = null;
    try {
      const respJson = await resp.json();
      user = {
        id: respJson.user.id,
        email: respJson.user.email,
        name: respJson.user.name,
        role: respJson.user.role,
        tenantId: respJson.user.tenantId,
      };
    } catch (error) {
      log.error("Failed to parse login response", { error });
    }

    if (resp.status < 400 && user) {
      return { form, user };
    } else {
      return fail(400, {
        form,
      });
    }
  },
};
