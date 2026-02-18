import { m } from "$i18n/messages";
import { z } from "zod";

export const formSchema = z.object({
  email: z.email(m["form.errors.email"]()),
  pin: z
    .string()
    .length(6, m["form.errors.pinLength"]())
    .regex(/^\d{6}$/, m["form.errors.pinDigitsOnly"]()),
});

export type FormSchema = typeof formSchema;
