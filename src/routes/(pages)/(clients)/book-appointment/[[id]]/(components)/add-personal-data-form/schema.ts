import { m } from "$i18n/messages";
import { z } from "zod/v4";

export const createFormSchema = (requirePhone?: boolean) => {
  return z.object({
    ...formSchema.shape,
    phone: requirePhone
      ? z.e164(m["form.errors.phoneNoInvalid"]())
      : z.e164(m["form.errors.phoneNoInvalid"]()).optional(),
  });
};

export const formSchema = z.object({
  name: z.string().min(2, m["form.errors.name"]()).max(50, m["form.errors.name"]()),
  email: z.string().email(m["form.errors.email"]()),
  phone: z.e164(m["form.errors.phoneNoInvalid"]()).optional(),
});

export type FormSchema = typeof formSchema;
