import { ROUTES } from "$lib/const/routes.js";
import logger from "$lib/logger";
import type { TTenantSettings } from "$lib/types/tenant";
import { redirect } from "@sveltejs/kit";

const log = logger.setContext(import.meta.filename);

export const load = async (event) => {
  event.depends(`channel:details`);

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
    } as TTenantSettings;
  });

  return {
    streamed: {
      item,
    },
  };
};
