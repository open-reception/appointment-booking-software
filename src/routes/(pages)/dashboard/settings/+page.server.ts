import { ROUTES } from "$lib/const/routes.js";
import logger from "$lib/logger";
import { fail, redirect, type Actions } from "@sveltejs/kit";
import { superValidate } from "sveltekit-superforms";
import { zod4 as zod } from "sveltekit-superforms/adapters";
import { formSchema as editFormSchema } from "./(components)/edit-settings-form";
import { removeEmptyTranslations } from "$lib/utils/localizations";

const log = logger.setContext(import.meta.filename);

export const load = async (event) => {
  // To edit seetings you must have connected tenant
  if (!event.locals.user?.tenantId) {
    log.warn("No tenant ID found for user while loading settings");
    throw redirect(302, ROUTES.DASHBOARD.MAIN);
  }

  const base = event
    .fetch(`/api/tenants/${event.locals.user?.tenantId}`, {
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
        return {
          id: body.tenant.id,
          languages: body.tenant.languages,
          defaultLanguage: body.tenant.defaultLanguage,
          shortName: body.tenant.shortName,
          longName: body.tenant.longName,
          logo: body.tenant.logo || "",
          descriptions: body.tenant.descriptions,
          links: {
            website: body.tenant.links.website || "",
            imprint: body.tenant.links.imprint || "",
            privacyStatement: body.tenant.links.privacyStatement || "",
          },
        };
      } catch (error) {
        log.error("Failed to parse settings base response", { error });
      }
    });

  const config = event
    .fetch(`/api/tenants/${event.locals.user?.tenantId}/config`, {
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
        return {
          address: {
            street: body["address.street"] || "",
            number: body["address.number"] || "",
            additionalAddressInfo: body["address.additionalAddressInfo"] || "",
            zip: body["address.zip"] || "",
            city: body["address.city"] || "",
          },
          settings: {
            autoDeleteDays: body.autoDeleteDays || 90,
            requirePhone: body.requirePhone || false,
          },
        };
      } catch (error) {
        log.error("Failed to parse settings config response", { error });
      }
    });

  const item = Promise.all([base, config]).then(([base, config]) => {
    return {
      ...base,
      ...config,
    };
  });

  return {
    streamed: {
      item,
    },
  };
};

export const actions: Actions = {
  edit: async (event) => {
    const form = await superValidate(event, zod(editFormSchema));

    if (!form.valid) {
      log.error("Edit settings form is not valid", { errors: form.errors });
      return fail(400, {
        form: { ...form, data: { ...form.data } },
        error: "Form is not valid",
      });
    }

    const base = await event.fetch(`/api/tenants/${form.data.id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "same-origin",
      body: JSON.stringify({
        languages: form.data.languages,
        defaultLanguage: form.data.defaultLanguage,
        longName: form.data.longName,
        logo: form.data.logo,
        descriptions: removeEmptyTranslations(form.data.descriptions),
        links: form.data.links,
      }),
    });

    const config = await event.fetch(`/api/tenants/${form.data.id}/config`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "same-origin",
      body: JSON.stringify({
        "address.street": form.data.address.street,
        "address.number": form.data.address.number,
        "address.additionalAddressInfo": form.data.address.additionalAddressInfo,
        "address.zip": form.data.address.zip,
        "address.city": form.data.address.city,
        autoDeleteDays: form.data.settings.autoDeleteDays,
        requirePhone: form.data.settings.requirePhone ?? false,
      }),
    });

    const resp = await Promise.all([base, config]).then(([base, config]) => {
      if (base.status < 400 && config.status < 400) {
        return { success: true };
      }
      return { success: false, bodies: { base: base, config: config } };
    });

    if (resp.success) {
      return { form };
    } else {
      const error = "Unknown error";
      const errors: { [key: string]: string } = {};
      try {
        const base = await resp.bodies?.base?.json();
        if (base.error) {
          errors["base"] = base.error;
        }
        const config = await resp.bodies?.config?.json();
        if (config.error) {
          errors["config"] = config.error;
        }
      } catch (e) {
        log.error("Failed to parse edit settings error response", { error: e });
      }
      return fail(400, {
        form: { ...form, data: { ...form.data } },
        error,
        errors,
      });
    }
  },
};
