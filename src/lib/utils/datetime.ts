import { getLocale } from "$i18n/runtime";
import type { TCalendarSlot } from "$lib/types/calendar";
import { parseAbsoluteToLocal, toCalendarDateTime } from "@internationalized/date";

export const toDisplayDateTime = (date: Date, opts?: Intl.DateTimeFormatOptions) => {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const formatter = new Intl.DateTimeFormat(
    getLocale(),
    opts ?? {
      dateStyle: "short",
      ...(hours !== 0 || minutes !== 0 ? { timeStyle: "short" } : {}),
    },
  );
  return formatter.format(date);
};

export const calendarItemToDate = (item: TCalendarSlot) => {
  if (item.start.includes("T")) {
    const parsedDate = new Date(item.start);
    if (!Number.isNaN(parsedDate.getTime())) {
      const [year, month, day] = item.date.split("-").map(Number);
      return new Date(
        year,
        month - 1,
        day,
        parsedDate.getUTCHours(),
        parsedDate.getUTCMinutes(),
        0,
        0,
      );
    }
  }

  const [year, month, day] = item.date.split("-").map(Number);
  const [hours, minutes] = item.start.split(":").map((it) => Number.parseInt(it));
  const date = new Date(year, month - 1, day);
  date.setHours(hours, minutes, 0, 0);
  return date;
};

export const toInputDateTime = (dateStr: string) => {
  return toCalendarDateTime(parseAbsoluteToLocal(dateStr));
};

export const getDefaultStartTime = () => {
  const date = new Date();
  date.setHours(7);
  date.setMinutes(0);
  date.setSeconds(0);
  date.setMilliseconds(0);
  return date.toISOString();
};

export const getDefaultEndTime = () => {
  const date = new Date();
  date.setHours(17);
  date.setMinutes(0);
  date.setSeconds(0);
  date.setMilliseconds(0);
  return date.toISOString();
};
