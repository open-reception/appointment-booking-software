import { z } from "zod";

export const formSchema = z.object({
  passkeyId: z.string(),
  deviceName: z.string().min(3).max(100),
});

export type FormSchema = typeof formSchema;
