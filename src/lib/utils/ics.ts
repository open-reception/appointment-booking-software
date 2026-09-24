import { m } from "$i18n/messages";
import type { TPublicTenant } from "$lib/types/public";
import * as ics from "ics";

export type IcsAppointment = {
  id: string;
  isRequested?: boolean | null;
  isConfirmed?: boolean | null;
  title: string;
  description?: string;
  location?: string;
  start: Date;
  duration: number;
  url?: string;
};

export const createIcsFile = (tenantUrl: URL, appointments: IcsAppointment[]) => {
  return ics.createEvents(
    appointments.map((appointment) => {
      const isNotConfirmed = appointment.isRequested && appointment.isConfirmed !== true;
      return {
        uid: `${appointment.id}@${tenantUrl.toString()}`,
        productId: "open-reception",
        title: `${isNotConfirmed ? `[${m["public.steps.complete.download.confirmationPending"]().toUpperCase()}] ` : ""}${appointment.title}`,
        status: isNotConfirmed ? "TENTATIVE" : "CONFIRMED",
        description: `${appointment.description ? `${appointment.description}\n\n` : ""}${m["ics.manageAppointment"]()}: ${tenantUrl.toString()}`,
        location: appointment.location,
        start: [
          appointment.start.getFullYear(),
          appointment.start.getMonth() + 1,
          appointment.start.getDate(),
          appointment.start.getHours(),
          appointment.start.getMinutes(),
        ],
        classification: "PRIVATE",
        transp: "OPAQUE",
        busyStatus: "BUSY",
        duration: { minutes: appointment.duration },
        url: appointment.url,
        attendees: [
          {
            name: "Dr. Jane Doe",
            email: "user@openreception",
            partstat: isNotConfirmed ? "TENTATIVE" : "ACCEPTED",
          },
        ],
        //   reminders: [{ method: "display", minutes: 60, before: true }],
      };
    }),
  );
};

export const downloadIcs = (tenantUrl: URL, appointments: IcsAppointment[]) => {
  const content = createIcsFile(tenantUrl, appointments).value;
  if (content) {
    const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `${appointments.length > 1 ? "appointments" : appointments[0].title}.ics`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
};

export const tenantAddressToIcsLocation = (address: TPublicTenant["address"]) => {
  if (!address) return undefined;
  const { street, number, zip, city } = address;
  return `${street} ${number}, ${zip} ${city}`;
};
