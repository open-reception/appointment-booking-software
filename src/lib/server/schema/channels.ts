import z from "zod/v4";

export const deadlineUnits = ["minutes", "hours", "days", "weeks", "months"] as const;
export const deadlineNames = ["bookMinAhead", "bookMaxAhead"] as const;

export const deadlineSchemaDuration = z.object({
  type: "duration",
  value: z.number().int().min(1).max(60),
  unit: z.enum(deadlineUnits),
});
export const deadlineSchema = z.union([deadlineSchemaDuration]);

export const deadlinesSchema = z.object({
  bookMinAhead: deadlineSchema.optional(),
  bookMaxAhead: deadlineSchema.optional(),
});

export type Deadline = z.infer<typeof deadlineSchema>;
export type Deadlines = z.infer<typeof deadlinesSchema>;
