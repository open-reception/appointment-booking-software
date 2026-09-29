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
  attendees: {
    name: string;
    email: string;
  }[];
};

export const createIcsFileForClient = (tenantUrl: URL, appointments: IcsAppointment[]) => {
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
        attendees: appointment.attendees.map((attendee) => ({
          name: attendee.name,
          email: attendee.email,
          partstat: isNotConfirmed ? "TENTATIVE" : "ACCEPTED",
        })),
        //   reminders: [{ method: "display", minutes: 60, before: true }],
      };
    }),
  );
};

export const createIcsFileForStaff = (tenantUrl: URL, appointments: IcsAppointment[]) => {
  return ics.createEvents(
    appointments.map((appointment) => {
      const isNotConfirmed = appointment.isRequested && appointment.isConfirmed !== true;
      return {
        uid: `${appointment.id}@${tenantUrl.toString()}`,
        productId: "open-reception",
        title: `${isNotConfirmed ? `[${m["public.steps.complete.download.confirmationPending"]().toUpperCase()}] ` : ""}${appointment.title}`,
        status: isNotConfirmed ? "TENTATIVE" : "CONFIRMED",
        description: `${appointment.description ? `${appointment.description}\n\n` : ""}${m["ics.viewAppointment"]()}: ${tenantUrl.toString()}`,
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
        attendees: appointment.attendees.map((attendee) => ({
          name: attendee.name,
          email: attendee.email,
          partstat: isNotConfirmed ? "TENTATIVE" : "ACCEPTED",
        })),
        //   reminders: [{ method: "display", minutes: 60, before: true }],
      };
    }),
  );
};

export const downloadIcsForClient = (tenantUrl: URL, appointments: IcsAppointment[]) => {
  const content = createIcsFileForClient(tenantUrl, appointments).value;
  if (content) {
    downloadIcs(content, `${appointments.length > 1 ? "appointments" : appointments[0].title}.ics`);
  }
};

export const downloadIcsForStaff = (tenantUrl: URL, appointments: IcsAppointment[]) => {
  const content = createIcsFileForStaff(tenantUrl, appointments).value;
  if (content) {
    downloadIcs(content, `${appointments.length > 1 ? "appointments" : appointments[0].title}.ics`);
  }
};

export const downloadIcs = (content: string, filename: string) => {
  if (content) {
    const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
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
