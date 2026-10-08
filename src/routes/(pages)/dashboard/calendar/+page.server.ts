import { ROUTES } from "$lib/const/routes.js";
import { logger } from "$lib/logger";
import type { SelectAppointmentProgress } from "$lib/server/db/tenant-schema.js";
import { getCurrentTranslation } from "$lib/utils/localizations.js";
import { redirect } from "@sveltejs/kit";
import { CALENDAR_ZOOM_STEPS } from "./(components)/utils.js";
import type { CalendarView } from "./types.js";

const log = logger.setContext(import.meta.filename);

export const load = ({ cookies, locals, fetch }) => {
  if (!locals.user?.tenantId) {
    log.error("User trying to access channels, but has no tenantId");
    redirect(302, ROUTES.LOGOUT);
  }

  // zoom
  const cookieZoom = cookies.get("calendarZoom");
  const parsedCookieZoom = cookieZoom && parseInt(cookieZoom);
  const calendarZoom =
    parsedCookieZoom && CALENDAR_ZOOM_STEPS.includes(parsedCookieZoom) ? parsedCookieZoom : 1;

  // view
  const cookieView = cookies.get("calendarView");
  const calendarView: CalendarView =
    cookieView && ["day", "week", "week-workdays"].includes(cookieView)
      ? (cookieView as CalendarView)
      : "day";

  // appointment progress states
  const progressStates = fetch(`/api/tenants/${locals.user?.tenantId}/appointments/progress`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "same-origin",
  }).then(async (res) => {
    // Logout if session expired
    if (res.status === 401) {
      redirect(302, ROUTES.LOGOUT);
    }

    try {
      const body = await res.json();
      const list = body.states as SelectAppointmentProgress[];
      return list
        .filter((item) => {
          const states = ["NOT_STARTED", "WAITING", "IN_PROGRESS", "DONE"];
          return states.includes(item.state);
        })
        .sort((a, b) =>
          getCurrentTranslation(a.names).localeCompare(getCurrentTranslation(b.names)),
        );
    } catch (error) {
      log.error("Failed to parse appointment progress response", { error });
    }
  });

  return { calendarView, calendarZoom, streamed: { progressStates } };
};
