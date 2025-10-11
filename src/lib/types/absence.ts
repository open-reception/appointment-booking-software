import type { SelectAgentAbsence } from "$lib/server/db/tenant-schema";

export type TAbsence = Omit<SelectAgentAbsence, "startDate" | "endDate"> & {
  startDate: string;
  endDate: string;
};
