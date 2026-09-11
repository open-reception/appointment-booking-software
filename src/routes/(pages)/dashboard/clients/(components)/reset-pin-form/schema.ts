import { m } from "$i18n/messages";
import { z } from "zod";

export const formSchema = z.object({
  tenant: z.string(),
  email: z.email(m["form.errors.email"]()),
  hashedEmail: z.string().optional(),
  language: z.string().default("en"),
});

export type FormSchema = typeof formSchema;
