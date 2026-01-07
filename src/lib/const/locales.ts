import { m } from "$i18n/messages";

export const supportedLocales = ["en", "de"] as const;

export type SupportedLocale = (typeof supportedLocales)[number];

export const translatedLocales = {
  en: m["locales.en"](),
  de: m["locales.de"](),
};

export const languageSwitchLocales = {
  de: { label: "Deutsch", value: "de", keywords: ["german", "deutsch"] },
  en: { label: "English", value: "en", keywords: ["english"] },
};
