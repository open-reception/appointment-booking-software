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
      timeZone: "Etc/GMT-1",
    },
  );
  return formatter.format(date);
};

export const calendarItemToDate = (item: TCalendarSlot) => {
  if (item.start.includes("T")) {
    const parsedDate = new Date(item.start);
    if (!Number.isNaN(parsedDate.getTime())) {
      const [year, month, day] = item.date.split("-").map(Number);

      // Get standard (non-DST) offset from a winter date
      const jan = new Date(year, 0, 1);
      const standardOffsetMs = jan.getTimezoneOffset() * 60 * 1000;

      // Build a UTC date and apply the standard offset
      const utc = Date.UTC(
        year,
        month - 1,
        day,
        parsedDate.getUTCHours(),
        parsedDate.getUTCMinutes(),
        0,
        0,
      );
      return new Date(utc - standardOffsetMs);
    }
  }

  throw new Error(`Unable to parse date from calendar item: ${item.start}`);
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

/*

    Date and Time processing
    See datetime.md for reference

*/

export const timeLocalWithoutOffsetToUTC = (localTime: string) => {
  const [hours, minutes, seconds] = localTime.split(":").map(Number);

  // Get the standard (non-DST) offset by checking a date in winter
  const jan = new Date(new Date().getFullYear(), 0, 1); // January 1st
  const standardOffsetMs = jan.getTimezoneOffset() * 60 * 1000;

  const now = new Date();
  now.setHours(hours, minutes, seconds, 0);

  // Remove the current offset and apply the standard one instead
  const utc = new Date(now.getTime() - now.getTimezoneOffset() * 60 * 1000 + standardOffsetMs);

  const utcHours = String(utc.getUTCHours()).padStart(2, "0");
  const utcMinutes = String(utc.getUTCMinutes()).padStart(2, "0");
  const utcSeconds = String(utc.getUTCSeconds()).padStart(2, "0");

  return `${utcHours}:${utcMinutes}:${utcSeconds}`;
};

export function timeUTCToLocalWithoutOffset(utcTime: string): string {
  const [hours, minutes, seconds] = utcTime.split(":").map(Number);

  // Standard (non-DST) offset
  const jan = new Date(new Date().getFullYear(), 0, 1);
  const standardOffsetMs = jan.getTimezoneOffset() * 60 * 1000;

  const now = new Date();
  now.setUTCHours(hours, minutes, seconds, 0);

  // Remove the standard offset, then re-apply the current one
  const local = new Date(now.getTime() + now.getTimezoneOffset() * 60 * 1000 - standardOffsetMs);

  const localHours = String(local.getHours()).padStart(2, "0");
  const localMinutes = String(local.getMinutes()).padStart(2, "0");
  const localSeconds = String(local.getSeconds()).padStart(2, "0");

  return `${localHours}:${localMinutes}:${localSeconds}`;
}

export const timeLocalToUTC = (localTime: string, date?: Date) => {
  const [hours, minutes, seconds] = localTime.split(":").map(Number);

  // Use the provided date (to get the correct DST offset for that day),
  // or fall back to today
  const target = date ? new Date(date) : new Date();
  target.setHours(hours, minutes, seconds, 0);

  const utcHours = String(target.getUTCHours()).padStart(2, "0");
  const utcMinutes = String(target.getUTCMinutes()).padStart(2, "0");
  const utcSeconds = String(target.getUTCSeconds()).padStart(2, "0");

  return `${utcHours}:${utcMinutes}:${utcSeconds}`;
};

export const timeUTCToLocal = (utcTime: string, date?: Date) => {
  const [hours, minutes, seconds] = utcTime.split(":").map(Number);

  const target = date ? new Date(date) : new Date();
  target.setUTCHours(hours, minutes, seconds, 0);

  const localHours = String(target.getHours()).padStart(2, "0");
  const localMinutes = String(target.getMinutes()).padStart(2, "0");
  const localSeconds = String(target.getSeconds()).padStart(2, "0");

  return `${localHours}:${localMinutes}:${localSeconds}`;
};

export const utcToLocalWithoutDST = (utcDate: Date): Date => {
  const jan = new Date(utcDate.getFullYear(), 0, 1);
  const standardOffsetMs = jan.getTimezoneOffset() * 60 * 1000;
  const currentOffsetMs = utcDate.getTimezoneOffset() * 60 * 1000;

  return new Date(utcDate.getTime() - standardOffsetMs + currentOffsetMs);
};

export const localToUTCWithoutDST = (localDate: Date): Date => {
  const jan = new Date(localDate.getFullYear(), 0, 1);
  const standardOffsetMs = jan.getTimezoneOffset() * 60 * 1000;
  const currentOffsetMs = localDate.getTimezoneOffset() * 60 * 1000;

  return new Date(localDate.getTime() + standardOffsetMs - currentOffsetMs);
};
