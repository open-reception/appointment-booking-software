import { ROUTES } from "$lib/const/routes.js";
import logger from "$lib/logger";
import { fail, redirect, type Actions } from "@sveltejs/kit";
import { superValidate } from "sveltekit-superforms";
import { zod4 as zod } from "sveltekit-superforms/adapters";
import { formSchema as addFormSchema } from "./(components)/add-tenant-form";
import { formSchema as editFormSchema } from "./(components)/edit-tenant-form";
import { formSchema as deleteFormSchema } from "./(components)/delete-tenant-form";
import type { TTenant } from "$lib/types/tenant";

const log = logger.setContext(import.meta.filename);

export const load = async (event) => {
  const list = event
    .fetch(`/api/tenants`, {
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
        return body.tenants as TTenant[];
      } catch (error) {
        log.error("Failed to parse tenants response", { error });
      }
    });

  return {
    form: await superValidate(zod(addFormSchema)),
    streamed: {
      list,
    },
  };
};

export const actions: Actions = {
  add: async (event) => {
    const form = await superValidate(event, zod(addFormSchema));

    if (!form.valid) {
      log.error("Add tenant form is not valid", { errors: form.errors });
      return fail(400, {
        form: { ...form, data: { ...form.data } },
        error: "Form is not valid",
      });
    }

    // Create tenant first
    const tenantResponse = await event.fetch(`/api/tenants`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "same-origin",
      body: JSON.stringify({
        shortName: form.data.shortName,
        domain: form.data.domain,
      }),
    });

    if (tenantResponse.status >= 400) {
      let error = "Unknown error";
      try {
        const body = await tenantResponse.json();
        error = body.error;
      } catch (e) {
        log.error("Failed to parse add tenant error response", { error: e });
      }
      return fail(400, {
        form,
        error,
      });
    }

    // If admin invitation requested, create user invitation
    if (form.data.inviteAdmin && form.data.email) {
      const tenantData = await tenantResponse.json();
      const tenantId = tenantData.tenant?.id;

      if (tenantId) {
        const userInviteResponse = await event.fetch(`/api/auth/invite`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "same-origin",
          body: JSON.stringify({
            email: form.data.email,
            name: form.data.email.split("@")[0],
            role: "TENANT_ADMIN",
            tenantId: tenantId,
          }),
        });

        if (userInviteResponse.status >= 400) {
          log.warn("Tenant created but user invitation failed", {
            tenantId,
            email: form.data.email,
          });
          // Don't fail the entire operation, just log the warning
        }
      }
    }

    return { form };
  },
  edit: async (event) => {
    const form = await superValidate(event, zod(editFormSchema));

    if (!form.valid) {
      log.error("Edit tenant form is not valid", { errors: form.errors });
      return fail(400, {
        form: { ...form, data: { ...form.data } },
        error: "Form is not valid",
      });
    }

    const resp = await event.fetch(`/api/tenants/${form.data.id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "same-origin",
      body: JSON.stringify({ domain: form.data.domain }),
    });

    if (resp.status < 400) {
      return { form };
    } else {
      let error = "Unknown error";
      try {
        const body = await resp.json();
        error = body.error;
      } catch (e) {
        log.error("Failed to parse edit tenant error response", { error: e });
      }
      return fail(400, {
        form: { ...form, data: { ...form.data } },
        error,
      });
    }
  },
  delete: async (event) => {
    const form = await superValidate(event, zod(deleteFormSchema));

    if (!form.valid) {
      log.error("Delete tenant form is not valid", { errors: form.errors });
      return fail(400, {
        form: { ...form, data: { ...form.data } },
        error: "Form is not valid",
      });
    }

    const resp = await event.fetch(`/api/tenants/${form.data.id}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "same-origin",
    });

    if (resp.status < 400) {
      return { form };
    } else {
      let error = "Unknown error";
      try {
        const body = await resp.json();
        error = body.error;
      } catch (e) {
        log.error("Failed to parse delete tenant error response", { error: e });
      }
      return fail(400, {
        form,
        error,
      });
    }
  },
};
