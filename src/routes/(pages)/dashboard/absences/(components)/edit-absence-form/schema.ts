import { m } from "$i18n/messages";
import { z } from "zod";

export const formSchema = z
  .object({
    id: z.string(),
    agent: z.string().uuid({ message: m["form.errors.noAgentsSelected"]() }),
    absenceType: z.string().min(1).max(100),
    description: z.string().optional(),
    startDate: z.string(),
    endDate: z.string(),
  })
  .superRefine((data, ctx) => {
    const start = new Date(data.startDate);
    const end = new Date(data.endDate);
    const now = new Date();

    if (end < start) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: m["form.errors.endDateBeforeStartDate"](),
        path: ["endDate"],
      });
    }

    if (end <= now) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: m["form.errors.endDateTooEarly"](),
        path: ["endDate"],
      });
    }
  });

export type FormSchema = typeof formSchema;
