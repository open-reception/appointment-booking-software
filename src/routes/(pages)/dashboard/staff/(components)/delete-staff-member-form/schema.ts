import { m } from "$i18n/messages";
import { z } from "zod";

export const formSchema = z.object({
  id: z.string(),
  email: z.string().email(m["form.errors.email"]()),
  confirmationState: z.enum(["INVITED", "CONFIRMED", "ACCESS_GRANTED"]),
});

export type FormSchema = typeof formSchema;
