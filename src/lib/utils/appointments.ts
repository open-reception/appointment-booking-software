import type { appointmentStatusEnum } from "$lib/server/db/tenant-schema";
import type { AppointmentStatus } from "$lib/types/calendar";

type BeStatusType = (typeof appointmentStatusEnum.enumValues)[number];

export const serverAppointmentStatusToUiFilterStatus = (
  status: BeStatusType,
): AppointmentStatus => {
  switch (status) {
    case "NEW":
      return "reserved";
    case "CONFIRMED":
    case "HELD":
    case "NO_SHOW":
      return "booked";
    case "REJECTED":
      return "rejected";
  }
};
