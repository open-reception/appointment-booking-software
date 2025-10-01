import { m } from "$i18n/messages";

export const supportedLocales = ["en", "de"] as const;

export const translatedLocales = {
  en: m["locales.en"](),
  de: m["locales.de"](),
};
