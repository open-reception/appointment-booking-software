import { m } from "$i18n/messages";
import { Calendar1, RefreshCw } from "@lucide/svelte";

export const reasons = [
  { label: m["absences.reasons.holiday"](), value: "HOLIDAY" },
  { label: m["absences.reasons.vacation"](), value: "VACATION" },
  { label: m["absences.reasons.sick"](), value: "SICK" },
  { label: m["absences.reasons.education"](), value: "EDUCATION" },
  { label: m["absences.reasons.off.site"](), value: "OFF-SITE" },
  { label: m["absences.reasons.other"](), value: "OTHER" },
] as const;

export const types = {
  ONE_TIME: {
    icon: Calendar1,
    value: "ONE_TIME",
    title: m["absences.types.ONE_TIME.title"](),
    description: m["absences.types.ONE_TIME.description"](),
  },
  ONGOING: {
    icon: RefreshCw,
    value: "ONGOING",
    title: m["absences.types.ONGOING.title"](),
    description: m["absences.types.ONGOING.description"](),
  },
};
