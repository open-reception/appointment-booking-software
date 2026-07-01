import type { CalendarDate } from "@internationalized/date";
import { fetchCalendar } from "./utils";
import { browser } from "$app/env";

export const calendarMonthQuery = (tenant: string | undefined | null, date: CalendarDate) => ({
  queryKey: ["calendar", `${date.year}-${date.month}`],
  queryFn: () => fetchCalendar({ tenant: tenant as string, selectedDate: date }),
  enabled: Boolean(tenant) && browser,
  staleTime: 5000,
});
