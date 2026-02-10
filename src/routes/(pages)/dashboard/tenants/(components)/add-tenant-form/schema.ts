import { m } from "$i18n/messages";
import { z } from "zod";

export const formSchema = z.object({
  shortName: z
    .string()
    .min(4, m["form.errors.shortname"]())
    .max(15, m["form.errors.shortname"]())
    .refine((val) => !val.startsWith("-") && !val.endsWith("-"), {
      message: m["tenants.add.name.errors.startEndDash"](),
    }),
  domain: z
    .string()
    .min(1)
    .max(253)
    .toLowerCase()
    .regex(/^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/, m["tenants.add.domain.errors.urlFormat"]()),
  inviteAdmin: z.boolean(),
  email: z.string().email(m["form.errors.email"]()).optional().or(z.literal("")),
});

export type FormSchema = typeof formSchema;
