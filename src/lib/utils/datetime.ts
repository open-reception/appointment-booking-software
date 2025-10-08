import { parseAbsoluteToLocal, toCalendarDateTime } from "@internationalized/date";

export const toDisplayDateTime = (date: Date) => {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const formatter = new Intl.DateTimeFormat(navigator.language, {
    dateStyle: "short",
    ...(hours !== 0 || minutes !== 0 ? { timeStyle: "short" } : {}),
  });
  return formatter.format(date);
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
