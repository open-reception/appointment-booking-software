import { m } from "$i18n/messages";
import { z } from "zod";

export const formSchema = z.object({
  passkeyId: z.string(),
  deviceName: z.string().min(2, m["form.errors.name"]()).max(50, m["form.errors.name"]()),
});

export type FormSchema = typeof formSchema;
