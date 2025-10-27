import { m } from "$i18n/messages";
import { z } from "zod";

export const formSchema = z.object({
  id: z.string(),
  name: z.string().min(2, m["form.errors.name"]()).max(50, m["form.errors.name"]()),
  email: z.string().email(m["form.errors.email"]()),
  role: z.enum(["STAFF", "TENANT_ADMIN", "GLOBAL_ADMIN"]).default("STAFF"),
});

export type FormSchema = typeof formSchema;
