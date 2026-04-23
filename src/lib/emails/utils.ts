import type { SupportedLocale } from "$lib/const/locales";

// is not exported from svelte
export type RenderOutput = {
  head: string;
  body: string;
};

export const renderOutputToHtml = (renderOutput: RenderOutput) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      ${renderOutput.head}
    </head>
    <body>
      ${renderOutput.body}
    </body>
    </html>
  `;
};

export const htmlToText = (html: string) => {
  let text = html;

  // Replace anchor tags with "Link Text: URL" format
  const newLinePlaceholder = "{new-line}";
  text = text.replace(/<a\s+(?:[^>]*?\s+)?href="([^"]*)"[^>]*>(.*?)<\/a>/gi, `$2: $1<br /><br />`);

  // Remove script and style tags and their content
  text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");

  // Unify breaks
  text = text.replace(new RegExp("<br />", "g"), "<br/>");

  // Placeholder for new lines
  text = text.replace(new RegExp("<br/>", "g"), newLinePlaceholder);

  // Replace block-level tags with newline placeholders
  const lineBreakingTags = ["p", "h1", "h2", "h3", "h4", "h5", "h6", "a"];
  lineBreakingTags.forEach((tag) => {
    const regexOpen = new RegExp(`</${tag}>`, "g");
    const regexClose = new RegExp(`</${tag}>`, "g");
    text = text
      .replace(regexOpen, newLinePlaceholder + newLinePlaceholder)
      .replace(regexClose, newLinePlaceholder + newLinePlaceholder);
  });

  // Remove html-only spans
  text = text.replace(/<span class="(.*)html-only(.*)">[\s\S]*?<\/span>/gi, "");

  // Remove all remaining HTML tags
  text = text.replace(/<[^>]*>/g, "");

  // Clean up extra whitespace
  text = text.replace(/\s+/g, " ").trim();

  // Replace newline placeholders with actual newlines
  text = text.replace(new RegExp(`${newLinePlaceholder} `, "g"), "\n");
  text = text.replace(new RegExp(newLinePlaceholder, "g"), "\n");
  text = text.trim();

  return text;
};

export const renderAppointmentDate = (date: Date, locale: SupportedLocale, timezone: string) => {
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: timezone,
  }).format(date);
};

export const renderAppointmentTime = (date: Date, locale: SupportedLocale, timezone: string) => {
  const time = new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone,
  }).format(date);

  const timeZoneName =
    new Intl.DateTimeFormat(locale, {
      timeZone: timezone,
      timeZoneName: "long",
    })
      .formatToParts(date)
      .find((part) => part.type === "timeZoneName")?.value ?? timezone;

  return `${time}, ${timeZoneName}`;
};
