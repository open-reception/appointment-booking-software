import { m } from "$i18n/messages";
import { z } from "zod";

export const formSchema = z.object({
  id: z.string(),
  name: z
    .string()
    .min(1, m["channels.add.fields.name.errors.length"]())
    .max(100, m["channels.add.fields.name.errors.length"]()),
});

export type FormSchema = typeof formSchema;
