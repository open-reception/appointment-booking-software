import type { Deadlines } from "$lib/server/schema/channels";
import { add, isBefore, sub } from "date-fns";

export const ensureItemIsWithinDeadlines = (
  utcStart: Date, // UTC
  deadlines: Deadlines,
) => {
  // Quick exit if there are no deadlines defined
  if (Object.keys(deadlines).length === 0) {
    return true;
  }

  const now = new Date();
  for (const key of Object.keys(deadlines) as (keyof Deadlines)[]) {
    const config = deadlines[key];
    if (!config) {
      continue;
    }

    switch (key) {
      case "bookMinAhead":
        {
          const deadline = sub(utcStart, { [config.unit]: config.value });
          const isBlocked = isBefore(deadline, now);
          if (isBlocked) {
            return false;
          }
        }
        break;
      case "bookMaxAhead":
        {
          const deadline = add(now, { [config.unit]: config.value });
          const isBlocked = isBefore(deadline, utcStart);
          if (isBlocked) {
            return false;
          }
        }
        break;
      default:
        break;
    }
  }

  // No matching deadlines, default to true
  return true;
};
