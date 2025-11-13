import { getLocale } from "$i18n/runtime";
import type { supportedLocales } from "$lib/const/locales";
import type { TPublicTenant } from "$lib/types/public";

export const removeEmptyTranslations = (object: { [key: string]: string } | undefined) => {
  if (!object) return object;

  // Remove all keys, but only if every value is empty
  const allEmpty = Object.values(object).every((value) => !value);
  if (allEmpty) return {};
  return object;
};

export const getCurrentTranlslation = (object: { [key: string]: string } | undefined) => {
  if (!object) return "[No Translation]";

  return object[getLocale()] || Object.values(object)[0];
};

export const getPublicLocale = (tenant: TPublicTenant): string => {
  const locale = getLocale();
  const availableLanguages = tenant.languages;
  if (availableLanguages.includes(locale as unknown as typeof supportedLocales)) {
    return locale;
  }
  return tenant.defaultLanguage as unknown as string;
};
