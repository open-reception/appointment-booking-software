import AppointmentBooked from "$lib/emails/AppointmentBooked.svelte";
import { renderOutputToHtml } from "$lib/emails/utils";
import type { RequestHandler } from "@sveltejs/kit";
import { render } from "svelte/server";

export const GET: RequestHandler = async () => {
  const emailRender = render(AppointmentBooked, { props: { name: "John Doe", locale: "de" } });

  return new Response(renderOutputToHtml(emailRender), {
    headers: {
      "Content-Type": "text/html",
    },
  });
};
