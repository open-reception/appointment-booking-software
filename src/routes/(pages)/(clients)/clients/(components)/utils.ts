import { m } from "$i18n/messages";

export const appointmentStatusToBadge = (status: string) => {
  switch (status) {
    case "NEW":
      return { label: m["clients.appointments.types.NEW"]() };
    case "CONFIRMED":
      return { label: m["clients.appointments.types.CONFIRMED"]() };
    default:
      return null;
  }
};
