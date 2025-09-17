import { m } from "$i18n/messages";
import { z } from "zod";

export const formSchema = z.object({
  shortname: z.string().min(4, m["form.errors.shortname"]()).max(20, m["form.errors.shortname"]()),
  id: z.string(),
});

export type FormSchema = typeof formSchema;
