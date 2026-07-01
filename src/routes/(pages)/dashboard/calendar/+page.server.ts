import { CALENDAR_ZOOM_STEPS } from "./(components)/utils.js";
import type { CalendarView } from "./types.js";

export const load = ({ cookies }) => {
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

  return { calendarView, calendarZoom };
};
