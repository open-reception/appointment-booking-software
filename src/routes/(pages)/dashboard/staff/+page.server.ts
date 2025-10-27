import { ROUTES } from "$lib/const/routes.js";
import logger from "$lib/logger";
import type { TStaff } from "$lib/types/users.js";
import { fail, redirect, type Actions } from "@sveltejs/kit";
import { superValidate } from "sveltekit-superforms";
import { zod4 as zod } from "sveltekit-superforms/adapters";
import { formSchema as addFormSchema } from "./(components)/add-staff-member-form";
import { formSchema as deleteFormSchema } from "./(components)/delete-staff-member-form";
import { formSchema as editFormSchema } from "./(components)/edit-staff-member-form";

const log = logger.setContext(import.meta.filename);

export const load = async (event) => {
  if (!event.locals.user?.tenantId) {
    log.error("User trying to access staff, but has no tenantId");
    redirect(302, ROUTES.LOGOUT);
  }

  const list = event
    .fetch(`/api/tenants/${event.locals.user?.tenantId}/staff`, {
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
        return body.staff as TStaff[];
      } catch (error) {
        log.error("Failed to parse staff members response", { error });
        return [];
      }
    });

  return {
    streamed: {
      list,
    },
  };
};

export const actions: Actions = {
  add: async (event) => {
    const form = await superValidate(event, zod(addFormSchema));

    if (!form.valid) {
      log.error("Add staff member form is not valid", { errors: form.errors });
      return fail(400, {
        form: { ...form, data: { ...form.data } },
        error: "Form is not valid",
      });
    }

    if (!event.locals.user?.tenantId) {
      log.error("User trying to add a staff member, but has no tenantId");
      redirect(302, ROUTES.LOGOUT);
    }

    const resp = await event.fetch(`/api/auth/invite`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "same-origin",
      body: JSON.stringify({
        name: form.data.name,
        email: form.data.email,
        language: form.data.language,
        role: form.data.role,
        tenantId: event.locals.user?.tenantId,
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
        log.error("Failed to parse add staff member error response", { error: e });
      }
      return fail(400, {
        form,
        error,
      });
    }
  },
  edit: async (event) => {
    const form = await superValidate(event, zod(editFormSchema));

    if (!form.valid) {
      log.error("Edit staff member form is not valid", { errors: form.errors });
      return fail(400, {
        form: { ...form, data: { ...form.data } },
        error: "Form is not valid",
      });
    }

    if (!event.locals.user?.tenantId) {
      log.error("User trying to edit a staff member, but has no tenantId");
      redirect(302, ROUTES.LOGOUT);
    }

    const resp = await event.fetch(
      `/api/tenants/${event.locals.user?.tenantId}/staff/${form.data.id}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify({
          name: form.data.name,
          email: form.data.email,
          role: form.data.role,
        }),
      },
    );

    if (resp.status < 400) {
      return { form };
    } else {
      let error = "Unknown error";
      try {
        const body = await resp.json();
        error = body.error;
      } catch (e) {
        log.error("Failed to parse edit staff member error response", { error: e });
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
      log.error("Delete staff member form is not valid", { errors: form.errors });
      return fail(400, {
        form: { ...form, data: { ...form.data } },
        error: "Form is not valid",
      });
    }

    if (!event.locals.user?.tenantId) {
      log.error("User trying to delete a staff member, but has no tenantId");
      redirect(302, ROUTES.LOGOUT);
    }

    const resp = await event.fetch(
      `/api/tenants/${event.locals.user?.tenantId}/staff/${form.data.id}?confirmationState=${form.data.confirmationState}`,
      {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
      },
    );

    if (resp.status < 400) {
      return { form };
    } else {
      let error = "Unknown error";
      try {
        const body = await resp.json();
        error = body.error;
      } catch (e) {
        log.error("Failed to parse delete staff member error response", { error: e });
      }
      return fail(400, {
        form,
        error,
      });
    }
  },
};
