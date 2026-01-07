import UserInvite from "$lib/emails/UserInvite.svelte";
import { htmlToText, renderOutputToHtml } from "$lib/emails/utils";
import type { SelectTenant } from "$lib/server/db/central-schema";
import type { RequestHandler } from "@sveltejs/kit";
import { render } from "svelte/server";

export const GET: RequestHandler = async () => {
  const emailRender = render(UserInvite, {
    props: {
      locale: "en",
      user: {
        email: "max.mustermann@example.com",
        name: "Max Mustermann",
        language: "en",
      },
      tenant: { longName: "Praxis Dr. Jane Doe" } as SelectTenant,
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
