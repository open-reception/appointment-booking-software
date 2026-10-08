import logger from "$lib/logger";
import { removeEmptyTranslations } from "$lib/utils/localizations";
import { fail, type Actions } from "@sveltejs/kit";
import { superValidate } from "sveltekit-superforms";
import { zod4 as zod } from "sveltekit-superforms/adapters";
import { formSchema as editFormSchema } from "./(components)/edit-settings-form";

const log = logger.setContext(import.meta.filename);

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

    const requests = [];
    if (form.data.longName || form.data.links) {
      const base = await event.fetch(`/api/tenants/${form.data.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify({
          ...(form.data.longName
            ? {
                languages: form.data.languages,
                defaultLanguage: form.data.defaultLanguage,
                longName: form.data.longName,
                logo: form.data.logo,
                descriptions: removeEmptyTranslations(form.data.descriptions),
              }
            : undefined),
          ...(form.data.links
            ? {
                links: form.data.links,
              }
            : undefined),
        }),
      });
      requests.push(base);
    }

    if (form.data.address || form.data.settings) {
      const config = await event.fetch(`/api/tenants/${form.data.id}/config`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify({
          ...(form.data.address
            ? {
                "address.street": form.data.address.street,
                "address.number": form.data.address.number,
                "address.additionalAddressInfo": form.data.address.additionalAddressInfo,
                "address.zip": form.data.address.zip,
                "address.city": form.data.address.city,
              }
            : undefined),
          ...(form.data.settings
            ? {
                autoDeleteDays: form.data.settings.autoDeleteDays,
                requirePhone: form.data.settings.requirePhone ?? false,
              }
            : undefined),
        }),
      });
      requests.push(config);
    }

    const resp = await Promise.all(requests).then((all) => {
      if (all.every((res) => res.status < 400)) {
        return { success: true };
      }
      return { success: false, bodies: { base: all[0], config: all[1] } };
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
