import { m } from "$i18n/messages";
import { z } from "zod";

export const formSchema = z.object({
  id: z.string(),
  domain: z
    .string()
    .min(1)
    .max(253)
    .toLowerCase()
    .regex(/^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/, m["tenants.add.domain.errors.urlFormat"]()),
  features: z.array(z.string()).optional(),
});

export type FormSchema = typeof formSchema;
