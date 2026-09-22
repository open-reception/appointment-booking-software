import { m } from "$i18n/messages";
import { z } from "zod";

export const formSchema = z.object({
  names: z
    .record(
      z.string(),
      z
        .string()
        .min(2, m["channels.add.fields.name.errors.length"]())
        .max(50, m["channels.add.fields.name.errors.length"]()),
    )
    .optional(),
  descriptions: z.record(z.string(), z.string()).optional(),
});

export type FormSchema = typeof formSchema;
