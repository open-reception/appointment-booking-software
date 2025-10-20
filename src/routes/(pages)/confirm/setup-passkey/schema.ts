import { m } from "$i18n/messages";
import { z } from "zod";

export const formSchema = z.object({
  userId: z.string().min(3),
  id: z.string().min(3),
  email: z.string().email(m["form.errors.email"]()),
  publicKeyBase64: z.string().base64(),
  authenticatorDataBase64: z.string().base64(),
});

export type FormSchema = typeof formSchema;
