import { m } from "$i18n/messages";
import { z } from "zod";

export const formSchema = z.object({
  name: z.string().min(2, m["form.errors.name"]()).max(50, m["form.errors.name"]()),
  language: z.string().default("en"),
});

export type FormSchema = typeof formSchema;
