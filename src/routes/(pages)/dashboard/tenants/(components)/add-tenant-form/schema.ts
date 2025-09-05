import { m } from "$i18n/messages";
import { z } from "zod";

export const formSchema = z.object({
  shortname: z
    .string()
    .min(4, m["form.errors.shortname"]())
    .max(20, m["form.errors.shortname"]())
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
      message: m["tenants.add.name.errors.urlFormat"](),
    })
    .refine((val) => !val.startsWith("-") && !val.endsWith("-"), {
      message: "Cannot start or end with a dash",
    }),
  inviteAdmin: z.boolean(),
  email: z.string().email(m["form.errors.email"]()).optional().or(z.literal("")),
});

export type FormSchema = typeof formSchema;
