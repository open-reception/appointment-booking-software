import { getLocale } from "$i18n/runtime";

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
