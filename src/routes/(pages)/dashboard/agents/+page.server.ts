import { ROUTES } from "$lib/const/routes.js";
import logger from "$lib/logger";
import { fail, redirect, type Actions } from "@sveltejs/kit";
import { superValidate } from "sveltekit-superforms";
import { zod } from "sveltekit-superforms/adapters";
import { formSchema as addFormSchema } from "./(components)/add-agent-form";
import { formSchema as editFormSchema } from "./(components)/edit-agent-form";
import { formSchema as deleteFormSchema } from "./(components)/delete-agent-form";
import type { TAgent } from "$lib/types/agent";

const log = logger.setContext(import.meta.filename);

export const load = async (event) => {
  if (!event.locals.user?.tenantId) {
    log.error("User trying to access agents, but has no tenantId");
    redirect(302, ROUTES.LOGOUT);
  }

  const list = event
    .fetch(`/api/tenants/${event.locals.user?.tenantId}/agents`, {
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
        return body.agents as TAgent[];
      } catch (error) {
        log.error("Failed to parse agents response", { error });
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
      log.error("Add agent form is not valid", { errors: form.errors });
      return fail(400, {
        form: { ...form, data: { ...form.data } },
        error: "Form is not valid",
      });
    }

    if (!event.locals.user?.tenantId) {
      log.error("User trying to add an agent, but has no tenantId");
      redirect(302, ROUTES.LOGOUT);
    }

    const resp = await event.fetch(`/api/tenants/${event.locals.user?.tenantId}/agents`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "same-origin",
      body: JSON.stringify({
        name: form.data.name,
        descriptions: form.data.descriptions,
        image: form.data.image,
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
        log.error("Failed to parse add agent error response", { error: e });
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
      log.error("Edit agent form is not valid", { errors: form.errors });
      return fail(400, {
        form: { ...form, data: { ...form.data } },
        error: "Form is not valid",
      });
    }

    if (!event.locals.user?.tenantId) {
      log.error("User trying to edit an agent, but has no tenantId");
      redirect(302, ROUTES.LOGOUT);
    }

    const resp = await event.fetch(
      `/api/tenants/${event.locals.user?.tenantId}/agents/${form.data.id}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify({
          name: form.data.name,
          descriptions: form.data.descriptions,
          image: form.data.image ?? null,
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
        log.error("Failed to parse edit agent error response", { error: e });
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
      log.error("Delete agent form is not valid", { errors: form.errors });
      return fail(400, {
        form: { ...form, data: { ...form.data } },
        error: "Form is not valid",
      });
    }

    if (!event.locals.user?.tenantId) {
      log.error("User trying to delete an agent, but has no tenantId");
      redirect(302, ROUTES.LOGOUT);
    }

    const resp = await event.fetch(
      `/api/tenants/${event.locals.user?.tenantId}/agents/${form.data.id}`,
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
        log.error("Failed to parse delete agent error response", { error: e });
      }
      return fail(400, {
        form,
        error,
      });
    }
  },
};
