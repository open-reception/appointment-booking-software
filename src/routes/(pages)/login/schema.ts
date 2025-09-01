import { m } from "$i18n/messages";
import { z } from "zod";

export const baseSchema = z.object({
  email: z.string().email(m["form.errors.email"]()),
});

const passkeySchema = baseSchema.extend({
  type: z.literal("passkey"),
  id: z.string().min(3),
  authenticatorDataBase64: z.string().base64(),
  clientDataBase64: z.string().base64(),
  signatureBase64: z.string().base64(),
});
const passphraseSchema = baseSchema.extend({
  type: z.literal("passphrase"),
  passphrase: z.string().min(30, m["form.errors.passphrase"]()),
});

export const formSchema = z.discriminatedUnion("type", [passkeySchema, passphraseSchema]);

export type FormSchema = typeof formSchema;
