import { times } from "$lib/components/ui/slot-template/utils";
import type { TAbsence } from "$lib/types/absence";
import {
  timeUTCToLocalWithoutOffset,
  toDisplayDateTime,
  toWeekdaysLabel,
} from "$lib/utils/datetime";
import { getLocalTimeZone } from "@internationalized/date";

export const renderAbsenceTimespan = (item: TAbsence) => {
  if (item.type === "ONE_TIME") {
    return renderOneTimeAbsenceTimespan(item);
  } else if (item.type === "REGULAR") {
    return renderRegularAbsenceTimespan(item);
  } else {
    return "";
  }
};

export const renderOneTimeAbsenceTimespan = (item: TAbsence) => {
  const startDate = toDisplayDateTime(new Date(item.startDate));
  const fullStartDay = toDisplayDateTime(new Date(item.startDate), {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: getLocalTimeZone(),
  });
  const endDate = toDisplayDateTime(new Date(item.endDate));
  const fullEndDay = toDisplayDateTime(new Date(item.endDate), {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: getLocalTimeZone(),
  });
  const isAllDay =
    new Date(item.startDate).getHours() === 0 &&
    new Date(item.startDate).getMinutes() === 0 &&
    new Date(item.endDate).getHours() === 23 &&
    new Date(item.endDate).getMinutes() === 59;
  const isSameDay =
    new Date(item.startDate).toDateString() === new Date(item.endDate).toDateString();
  if (isSameDay && isAllDay) {
    return `${fullStartDay}`;
  } else if (isAllDay) {
    return `${fullStartDay} - ${fullEndDay}`;
  } else {
    return `${startDate} - ${endDate}`;
  }
};

export const renderRegularAbsenceTimespan = (item: TAbsence) => {
  if (!item.from || !item.to) {
    return "";
  }

  const weekdays = item.weekdays ?? 0;
  const from = timeUTCToLocalWithoutOffset(item.from) as keyof typeof times;
  const to = timeUTCToLocalWithoutOffset(item.to) as keyof typeof times;
  return `${renderOneTimeAbsenceTimespan(item)}; ${toWeekdaysLabel(weekdays)} ${times[from]?.label ?? ""} - ${times[to]?.label ?? ""}`;
};
