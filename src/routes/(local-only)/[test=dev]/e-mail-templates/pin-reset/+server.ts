import PinReset from "$lib/emails/PinReset.svelte";
import { renderOutputToHtml, htmlToText } from "$lib/emails/utils";
import type { SelectTenant } from "$lib/server/db/central-schema";
import type { RequestHandler } from "@sveltejs/kit";
import { render } from "svelte/server";

export const GET: RequestHandler = async () => {
  const emailRender = render(PinReset, {
    props: {
      locale: "en",
      user: {
        email: "max.mustermann@example.com",
        language: "en",
      },
      tenant: { longName: "Praxis Dr. Jane Doe" } as SelectTenant,
      loginUrl: "https://open-reception.org/login",
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
