import { m } from "$i18n/messages";
import { z } from "zod";

export const formSchema = z
  .object({
    passphrase: z.string().min(30, m["form.errors.passphrase"]()),
    newPassphrase: z.string().min(30, m["form.errors.passphrase"]()),
    repeatedPassphrase: z.string().min(30, m["form.errors.passphrase"]()),
  })
  .check((ctx) => {
    if (ctx.value.newPassphrase !== ctx.value.repeatedPassphrase) {
      ctx.issues.push({
        code: "custom",
        message: m["form.errors.passphraseMismatch"](),
        path: ["repeatedPassphrase"],
        input: ctx.value.repeatedPassphrase,
      });
    }
  });

export type FormSchema = typeof formSchema;
