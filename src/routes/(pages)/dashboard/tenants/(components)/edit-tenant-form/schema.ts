import { m } from "$i18n/messages";
import { z } from "zod";

export const formSchema = z.object({
  shortName: z
    .string()
    .min(4, m["form.errors.shortname"]())
    .max(15, m["form.errors.shortname"]())
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
      error: m["tenants.add.name.errors.urlFormat"](),
    })
    .refine((val) => !val.startsWith("-") && !val.endsWith("-"), {
      error: m["tenants.add.name.errors.startEndDash"](),
    }),
  id: z.string(),
});

export type FormSchema = typeof formSchema;
