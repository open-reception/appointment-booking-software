import { browser } from "$app/environment";
import type { TCalendar } from "$lib/types/calendar";
import { toCalendarDateTime, toZoned, type CalendarDate } from "@internationalized/date";

export const fetchCalendar = async (opts: { tenant: string; startDate: CalendarDate }) => {
  if (!browser) return;

  const params = new URLSearchParams({
    startDate: toZoned(opts.startDate, "UTC").toAbsoluteString(),
    endDate: toZoned(
      toCalendarDateTime(opts.startDate).set({
        hour: 23,
        minute: 59,
        second: 59,
        millisecond: 999,
      }),
      "UTC",
    ).toAbsoluteString(),
  });
  const res = await fetch(`/api/tenants/${opts.tenant}/calendar?${params}`, {
    method: "GET",
  });

  if (res.status < 400) {
    try {
      const data = await res.json();
      return data as TCalendar;
    } catch (error) {
      console.error("Unable to parse calendar response", error);
    }
  } else {
    console.error("Invalid calendar response");
  }
};
