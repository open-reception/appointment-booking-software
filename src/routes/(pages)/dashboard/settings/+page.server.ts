import { ROUTES } from "$lib/const/routes.js";
import logger from "$lib/logger";
import { fail, redirect, type Actions } from "@sveltejs/kit";
import { superValidate } from "sveltekit-superforms";
import { zod } from "sveltekit-superforms/adapters";
import { formSchema as editFormSchema } from "./(components)/edit-settings-form";
import { removeEmptyTranslations } from "$lib/utils/localizations";

const log = logger.setContext(import.meta.filename);

export const load = async (event) => {
  // To edit seetings you must have connected tenant
  if (!event.locals.user?.tenantId) {
    log.warn("No tenant ID found for user while loading settings");
    throw redirect(302, ROUTES.DASHBOARD.MAIN);
  }

  const item = event
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
        console.log("+++++++++++++", body);
        return {
          id: "some-id",
          shortName: "praxisdrdoe",
          longName: "Praxis Dr. Jane Doe",
          logo: "",
          descriptions: { en: "some-description" },
          address: {
            street: "Musterstrasse",
            number: "1",
            additionalAddressInfo: "Hinterhaus",
            zip: "20000",
            city: "Musterstadt",
          },
          legal: {
            website: "https://example.com",
            imprint: "https://example.com/imprint",
            privacyStatement: "https://example.com/privacy",
          },
          settings: {
            languages: ["en"],
            defaultLanguage: "en",
            autoDeleteDays: 90,
            requirePhone: true,
          },
        };
      } catch (error) {
        log.error("Failed to parse agents response", { error });
      }
    });

  return {
    form: await superValidate(zod(editFormSchema)),
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

    console.log("req body", {
      languages: form.data.settings.languages,
      defaultLanguage: form.data.settings.defaultLanguage,
      longName: form.data.longName,
      logo: form.data.logo,
      descriptions: removeEmptyTranslations(form.data.descriptions),
      street: form.data.address.street,
      number: form.data.address.number,
      additionalAddressInfo: form.data.address.additionalAddressInfo,
      zip: form.data.address.zip,
      city: form.data.address.city,
      website: form.data.legal.website,
      imprint: form.data.legal.imprint,
      privacyStatement: form.data.legal.privacyStatement,
      autoDeleteDays: form.data.settings.autoDeleteDays,
      requirePhone: form.data.settings.requirePhone ?? false,
    });
    return { form };

    const resp = await event.fetch(`/api/tenants/${form.data.id}/config`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "same-origin",
      body: JSON.stringify({
        languages: form.data.settings.languages,
        defaultLanguage: form.data.settings.defaultLanguage,
        longName: form.data.longName,
        logo: form.data.logo,
        descriptions: removeEmptyTranslations(form.data.descriptions),
        street: form.data.address.street,
        number: form.data.address.number,
        additionalAddressInfo: form.data.address.additionalAddressInfo,
        zip: form.data.address.zip,
        city: form.data.address.city,
        website: form.data.legal.website,
        imprint: form.data.legal.imprint,
        privacyStatement: form.data.legal.privacyStatement,
        autoDeleteDays: form.data.settings.autoDeleteDays,
        requirePhone: form.data.settings.requirePhone ?? false,
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
        log.error("Failed to parse edit settings error response", { error: e });
      }
      return fail(400, {
        form: { ...form, data: { ...form.data } },
        error,
      });
    }
  },
};
