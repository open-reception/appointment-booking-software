import AppointmentReminder from "$lib/emails/AppointmentReminder.svelte";
import { renderOutputToHtml, htmlToText } from "$lib/emails/utils";
import type { SelectTenant } from "$lib/server/db/central-schema";
import type { SelectAppointment } from "$lib/server/db/tenant-schema";
import type { RequestHandler } from "@sveltejs/kit";
import { render } from "svelte/server";

export const GET: RequestHandler = async () => {
  const emailRender = render(AppointmentReminder, {
    props: {
      locale: "en",
      user: {
        email: "max.mustermann@example.com",
        language: "en",
      },
      tenant: { longName: "Praxis Dr. Jane Doe" } as SelectTenant,
      appointment: {
        appointmentDate: new Date("2024-06-30T10:00:00"),
        agentName: "Dr. John Doe",
      } as SelectAppointment & { agentName: string },
      channel: "Vaccination Appointment",
      address: {
        street: "Musterstraße",
        number: "1",
        additionalAddressInfo: "Hinterhaus",
        zip: "20000",
        city: "Hamburg",
      },
      cancelUrl: "https://open-reception.org/appointments/cancel/abc123",
    },
  });
  const html = renderOutputToHtml(emailRender);
  const text = htmlToText(html);

  // Output for testing purposes
  console.log(text);
  return new Response(html, {
    headers: {
      "Content-Type": "text/html",
    },
  });
};
