import { m } from "$i18n/messages";
import { z } from "zod";

export const baseSchema = z.object({
  email: z.string().email(m["form.errors.email"]()),
  language: z.enum(["de", "en"]),
});

const passkeySchema = baseSchema.extend({
  type: z.literal("passkey"),
  id: z.string().min(3),
  attestationObjectBase64: z.string().base64(),
  clientDataJSONBase64: z.string().base64(),
});
const passphraseSchema = baseSchema.extend({
  type: z.literal("passphrase"),
  passphrase: z.string().min(30, m["form.errors.passphrase"]()),
});

export const formSchema = z.discriminatedUnion("type", [passkeySchema, passphraseSchema]);

export type FormSchema = typeof formSchema;
