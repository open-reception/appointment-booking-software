import type { TNewSlotTemplate } from "$lib/types/channel";
import { localTimeToUTC } from "$lib/utils/datetime";

export const DEFAULT_SLOT_TEMPLATE: TNewSlotTemplate = {
  weekdays: 31,
  from: localTimeToUTC("09:00:00"),
  to: localTimeToUTC("17:00:00"),
  duration: 15,
};
