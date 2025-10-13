import { m } from "$i18n/messages";

export const reasons = [
  { label: m["absences.reasons.holiday"](), value: "HOLIDAY" },
  { label: m["absences.reasons.vacation"](), value: "VACATION" },
  { label: m["absences.reasons.sick"](), value: "SICK" },
  { label: m["absences.reasons.education"](), value: "EDUCATION" },
  { label: m["absences.reasons.off.site"](), value: "OFF-SITE" },
  { label: m["absences.reasons.other"](), value: "OTHER" },
] as const;
