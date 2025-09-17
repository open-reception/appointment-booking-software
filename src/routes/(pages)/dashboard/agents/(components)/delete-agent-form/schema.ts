import { m } from "$i18n/messages";
import { z } from "zod";

export const formSchema = z.object({
  id: z.string(),
  name: z.string().min(4, m["form.errors.name"]()).max(20, m["form.errors.name"]()),
});

export type FormSchema = typeof formSchema;
