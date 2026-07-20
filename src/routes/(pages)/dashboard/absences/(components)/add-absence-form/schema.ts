import { m } from "$i18n/messages";
import { z } from "zod";

export const formSchema = z
  .object({
    type: z.enum(["ONE_TIME", "REGULAR"]),
    agent: z.string().uuid({ message: m["form.errors.noAgentsSelected"]() }),
    absenceType: z.string().min(1).max(100),
    description: z.string().optional(),
    startDate: z.string(),
    endDate: z.string(),
    weekdays: z.number().int().min(0).max(127).optional(),
    from: z
      .string()
      .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/)
      .optional(),
    to: z
      .string()
      .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/)
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (data.type === "REGULAR") {
      if (data.weekdays == null || data.weekdays === 0) {
        ctx.addIssue({
          code: "custom",
          message: m["form.errors.noWeekdaysSelected"](),
          path: ["weekdays"],
        });
      }

      if (data.from && data.to) {
        const fromDate = new Date(`1970-01-01T${data.from}Z`);
        const toDate = new Date(`1970-01-01T${data.to}Z`);

        if (fromDate >= toDate) {
          ctx.addIssue({
            code: "custom",
            message: m["form.errors.fromAfterTo"](),
            path: ["from"],
          });
        }
      }
    }
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
