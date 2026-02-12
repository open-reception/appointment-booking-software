import { m } from "$i18n/messages";
import { z } from "zod";

export const formSchema = z.object({
  shareEmail: z.boolean(),
  name: z.string().min(2, m["form.errors.name"]()).max(50, m["form.errors.name"]()),
  phone: z.e164(m["form.errors.phoneNoInvalid"]()).optional(),
});

export type FormSchema = typeof formSchema;
