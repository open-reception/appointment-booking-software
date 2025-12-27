import { m } from "$i18n/messages";
import { z } from "zod";

export const formSchema = z.object({
  userId: z.string().min(3),
  id: z.string().min(3),
  email: z.string().email(m["form.errors.email"]()),
  attestationObjectBase64: z.string().base64(),
  clientDataJSONBase64: z.string().base64(),
  challenge: z.string().min(20), // Original registration challenge (before PRF challenge overwrites cookie)
});

export type FormSchema = typeof formSchema;
