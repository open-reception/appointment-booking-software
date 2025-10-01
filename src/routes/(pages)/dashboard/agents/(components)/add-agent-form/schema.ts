import { m } from "$i18n/messages";
import { z } from "zod";

export const formSchema = z.object({
  name: z
    .string()
    .min(2, m["agents.add.fields.name.errors.length"]())
    .max(50, m["agents.add.fields.name.errors.length"]()),
  descriptions: z.record(z.string(), z.string()).optional(),
  image: z.string().optional().or(z.literal("")),
});

export type FormSchema = typeof formSchema;
