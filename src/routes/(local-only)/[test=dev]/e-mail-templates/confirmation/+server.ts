import Confirmation from "$lib/emails/Confirmation.svelte";
import { htmlToText, renderOutputToHtml } from "$lib/emails/utils";
import type { RequestHandler } from "@sveltejs/kit";
import { render } from "svelte/server";

export const GET: RequestHandler = async () => {
  const emailRender = render(Confirmation, {
    props: {
      locale: "en",
      user: {
        email: "max.mustermann@example.com",
        name: "Max Mustermann",
        language: "en",
      },
      confirmUrl: "https://open-reception.org/confirm/abc123",
      expirationMinutes: 10,
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
