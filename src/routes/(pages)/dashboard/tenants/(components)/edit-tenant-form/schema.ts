import { m } from "$i18n/messages";
import { z } from "zod";

export const formSchema = z.object({
  domain: z
    .string()
    .min(1)
    .max(253)
    .toLowerCase()
    .regex(/^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/, m["tenants.add.domain.errors.urlFormat"]()),
  id: z.string(),
});

export type FormSchema = typeof formSchema;
