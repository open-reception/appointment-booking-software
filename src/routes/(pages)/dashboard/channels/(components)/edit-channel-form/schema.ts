import { m } from "$i18n/messages";
import { z } from "zod";

export const formSchema = z.object({
  id: z.string(),
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
  agentIds: z.array(z.string()).default([]),
  isPublic: z.boolean().optional().default(false),
  requiresConfirmation: z.boolean().optional().default(false),
  slotTemplates: z
    .array(
      z.object({
        id: z.string().optional(),
        weekdays: z.number().int().min(0).max(127).default(15),
        from: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/),
        to: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/),
        duration: z.number().int().min(1).max(1440),
      }),
    )
    .optional()
    .default([]),
});

export type FormSchema = typeof formSchema;
