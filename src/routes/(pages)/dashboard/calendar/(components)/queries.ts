import type { CalendarDate } from "@internationalized/date";
import { fetchCalendar } from "./utils";

export const calendarMonthQuery = (tenant: string | undefined | null, date: CalendarDate) => ({
  queryKey: ["calendar", `${date.year}-${date.month}`],
  queryFn: () => fetchCalendar({ tenant: tenant as string, selectedDate: date }),
  enabled: Boolean(tenant),
  staleTime: 5000,
});
