import { cookieName, extractLocaleFromHeader, setLocale, type Locale } from "$i18n/runtime";
import { paraglideMiddleware } from "$i18n/server";
import type { Handle } from "@sveltejs/kit";

/**
 * SvelteKit server hook that handles i18n localization
 *
 * @param {Object} params - Hook parameters
 * @param {import('@sveltejs/kit').RequestEvent} params.event - The request event
 * @param {Function} params.resolve - Function to resolve the request
 * @returns {Promise<Response>} The response with applied headers and rate limiting
 */
export const i18nHandle: Handle = ({ event, resolve }) => {
  // Disable i18n for API and local-only routes
  // Avoids using i18n middleware where emails are rendered
  if (event.url.pathname.startsWith("/api") || event.url.pathname.startsWith("/local-only")) {
    return resolve(event);
  }

  // Determine browser locale and use it
  const cookieLocale = event.cookies.get(cookieName);
  let locale: Locale | undefined = cookieLocale as Locale;

  if (!locale) {
    locale = extractLocaleFromHeader(event.request);
    setLocale(locale);
    event.locals.locale = locale;
  }

  return paraglideMiddleware(event.request, ({ request: localizedRequest, locale }) => {
    event.request = localizedRequest;
    return resolve(event, {
      transformPageChunk: ({ html }) => {
        return html.replace("%lang%", locale);
      },
    });
  });
};
