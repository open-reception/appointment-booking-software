import { ROUTES } from "$lib/const/routes.js";
import logger from "$lib/logger";
import { fail, redirect, type Actions } from "@sveltejs/kit";
import { superValidate } from "sveltekit-superforms";
import { zod4 as zod } from "sveltekit-superforms/adapters";
import { formSchema as addFormSchema } from "./(components)/add-absence-form";
import { formSchema as editFormSchema } from "./(components)/edit-absence-form";
import { formSchema as deleteFormSchema } from "./(components)/delete-absence-form";
import type { TAbsence } from "$lib/types/absence";

const log = logger.setContext(import.meta.filename);

export const load = async (event) => {
  if (!event.locals.user?.tenantId) {
    log.error("User trying to access absences, but has no tenantId");
    redirect(302, ROUTES.LOGOUT);
  }

  const thisMorning = new Date();
  thisMorning.setHours(0, 0, 0, 0);
  const params = {
    startDate: thisMorning.toISOString(),
    endDate: "2099-12-31T23:59:59.999Z",
  } as const;
  const queryString = Object.entries(params)
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
  const list = event
    .fetch(`/api/tenants/${event.locals.user?.tenantId}/agents/absences?${queryString}`, {
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
        return body.absences as TAbsence[];
      } catch (error) {
        log.error("Failed to parse absences response", { error });
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
      log.error("Add absence form is not valid", { errors: form.errors });
      return fail(400, {
        form: { ...form, data: { ...form.data } },
        error: "Form is not valid",
      });
    }

    if (!event.locals.user?.tenantId) {
      log.error("User trying to add an absence, but has no tenantId");
      redirect(302, ROUTES.LOGOUT);
    }

    const resp = await event.fetch(
      `/api/tenants/${event.locals.user?.tenantId}/agents/${form.data.agent}/absences`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify({
          description: form.data.description,
          absenceType: form.data.absenceType,
          startDate: new Date(form.data.startDate).toISOString(),
          endDate: new Date(form.data.endDate).toISOString(),
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
        log.error("Failed to parse add absence error response", { error: e });
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
      log.error("Edit absence form is not valid", { errors: form.errors });
      return fail(400, {
        form: { ...form, data: { ...form.data } },
        error: "Form is not valid",
      });
    }

    if (!event.locals.user?.tenantId) {
      log.error("User trying to edit an absence, but has no tenantId");
      redirect(302, ROUTES.LOGOUT);
    }

    const resp = await event.fetch(
      `/api/tenants/${event.locals.user?.tenantId}/agents/${form.data.agent}/absences/${form.data.id}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify({
          description: form.data.description,
          absenceType: form.data.absenceType,
          startDate: new Date(form.data.startDate).toISOString(),
          endDate: new Date(form.data.endDate).toISOString(),
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
        log.error("Failed to parse edit absences error response", { error: e });
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
      log.error("Delete absence form is not valid", { errors: form.errors });
      return fail(400, {
        form: { ...form, data: { ...form.data } },
        error: "Form is not valid",
      });
    }

    if (!event.locals.user?.tenantId) {
      log.error("User trying to delete an absence, but has no tenantId");
      redirect(302, ROUTES.LOGOUT);
    }

    const resp = await event.fetch(
      `/api/tenants/${event.locals.user?.tenantId}/agents/${form.data.agent}/absences/${form.data.id}`,
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
        log.error("Failed to parse delete absence error response", { error: e });
      }
      return fail(400, {
        form,
        error,
      });
    }
  },
};
