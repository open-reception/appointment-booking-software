import { m } from "$i18n/messages";
import { z } from "zod";

const optionalUrl = (errorMessage: string) =>
  z.union([z.literal(""), z.url({ message: errorMessage })]).optional();

export const formSchema = z
  .object({
    id: z.string(),
    languages: z.array(z.string()).min(1, { message: m["form.errors.languages"]() }),
    defaultLanguage: z.string().min(1, { message: m["form.errors.language"]() }),
    shortName: z.string(),
    longName: z.string().min(1, { message: m["form.errors.longname"]() }),
    logo: z.string().optional().or(z.literal("")),
    descriptions: z.record(z.string(), z.string()).optional(),
    address: z.object({
      street: z.string().min(1, { message: m["form.errors.street"]() }),
      number: z.string().min(1, { message: m["form.errors.houseNo"]() }),
      additionalAddressInfo: z.string().optional().or(z.literal("")),
      zip: z.string().min(4, { message: m["form.errors.zip"]() }),
      city: z.string().min(1, { message: m["form.errors.city"]() }),
    }),
    links: z.object({
      website: optionalUrl(m["form.errors.url"]()),
      imprint: optionalUrl(m["form.errors.url"]()),
      privacyStatement: optionalUrl(m["form.errors.url"]()),
    }),
    settings: z.object({
      autoDeleteDays: z.number().min(30, { message: m["form.errors.deleteAfterDays"]() }),
      requirePhone: z.boolean().optional().default(false),
    }),
  })
  .superRefine(({ languages, defaultLanguage }, ctx) => {
    if (!languages.includes(defaultLanguage)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: m["settings.form.fields.defaultLanguage.errors.notInLanguages"](),
        path: ["defaultLanguage"],
      });
    }
  });

export type FormSchema = typeof formSchema;
