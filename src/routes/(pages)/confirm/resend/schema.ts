import { m } from "$i18n/messages";
import { z } from "zod";

export const formSchema = z.object({
  email: z.string().email(m["form.errors.email"]()),
});

export type FormSchema = typeof formSchema;
