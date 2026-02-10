import { ROUTES } from "$lib/const/routes.js";
import logger from "$lib/logger";
import { fail, redirect, type Actions } from "@sveltejs/kit";
import { superValidate } from "sveltekit-superforms";
import { zod4 as zod } from "sveltekit-superforms/adapters";
import { formSchema as addFormSchema } from "./(components)/add-channel-form";
import { formSchema as editFormSchema } from "./(components)/edit-channel-form";
import { formSchema as deleteFormSchema } from "./(components)/delete-channel-form";
import { formSchema as pauseFormSchema } from "./(components)/pause-channel-form";
import type { TChannel } from "$lib/types/channel";
import { removeEmptyTranslations } from "$lib/utils/localizations";

const log = logger.setContext(import.meta.filename);

export const load = async (event) => {
  if (!event.locals.user?.tenantId) {
    log.error("User trying to access channels, but has no tenantId");
    redirect(302, ROUTES.LOGOUT);
  }

  const list = event
    .fetch(`/api/tenants/${event.locals.user?.tenantId}/channels`, {
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
        return body.channels as TChannel[];
      } catch (error) {
        log.error("Failed to parse channels response", { error });
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
      log.error("Add channel form is not valid", { errors: form.errors });
      return fail(400, {
        form: { ...form, data: { ...form.data } },
        error: "Form is not valid",
      });
    }

    if (!event.locals.user?.tenantId) {
      log.error("User trying to add a channel, but has no tenantId");
      redirect(302, ROUTES.LOGOUT);
    }

    const resp = await event.fetch(`/api/tenants/${event.locals.user?.tenantId}/channels`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "same-origin",
      body: JSON.stringify({
        names: form.data.names,
        descriptions: removeEmptyTranslations(form.data.descriptions),
        agentIds: form.data.agentIds,
        staffIds: form.data.staffIds,
        isPublic: form.data.isPublic,
        requiresConfirmation: form.data.requiresConfirmation,
        slotTemplates: form.data.slotTemplates,
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
        log.error("Failed to parse add channel error response", { error: e });
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
      log.error("Edit channel form is not valid", { errors: form.errors });
      return fail(400, {
        form: { ...form, data: { ...form.data } },
        error: "Form is not valid",
      });
    }

    if (!event.locals.user?.tenantId) {
      log.error("User trying to edit a channel, but has no tenantId");
      redirect(302, ROUTES.LOGOUT);
    }

    const resp = await event.fetch(
      `/api/tenants/${event.locals.user?.tenantId}/channels/${form.data.id}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify({
          names: form.data.names,
          descriptions: removeEmptyTranslations(form.data.descriptions),
          agentIds: form.data.agentIds,
          staffIds: form.data.staffIds,
          isPublic: form.data.isPublic,
          requiresConfirmation: form.data.requiresConfirmation,
          slotTemplates: form.data.slotTemplates,
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
        log.error("Failed to parse edit channels error response", { error: e });
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
      log.error("Delete channel form is not valid", { errors: form.errors });
      return fail(400, {
        form: { ...form, data: { ...form.data } },
        error: "Form is not valid",
      });
    }

    if (!event.locals.user?.tenantId) {
      log.error("User trying to delete a channel, but has no tenantId");
      redirect(302, ROUTES.LOGOUT);
    }

    const resp = await event.fetch(
      `/api/tenants/${event.locals.user?.tenantId}/channels/${form.data.id}`,
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
        log.error("Failed to parse delete channel error response", { error: e });
      }
      return fail(400, {
        form,
        error,
      });
    }
  },
  pause: async (event) => {
    const form = await superValidate(event, zod(pauseFormSchema));

    if (!form.valid) {
      log.error("Pause/unpause channel form is not valid", { errors: form.errors });
      return fail(400, {
        form: { ...form, data: { ...form.data } },
        error: "Form is not valid",
      });
    }

    if (!event.locals.user?.tenantId) {
      log.error("User trying to pause/unpause a channel, but has no tenantId");
      redirect(302, ROUTES.LOGOUT);
    }

    const resp = await event.fetch(
      `/api/tenants/${event.locals.user?.tenantId}/channels/${form.data.id}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify({
          pause: form.data.pause,
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
        log.error("Failed to parse pause/unpause channel error response", { error: e });
      }
      return fail(400, {
        form,
        error,
      });
    }
  },
};
