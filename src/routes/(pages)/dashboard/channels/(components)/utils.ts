import type { TNewSlotTemplate } from "$lib/types/channel";
import { timeLocalWithoutOffsetToUTC } from "$lib/utils/datetime";

export const DEFAULT_SLOT_TEMPLATE: TNewSlotTemplate = {
  weekdays: 31,
  from: timeLocalWithoutOffsetToUTC("09:00:00"),
  to: timeLocalWithoutOffsetToUTC("17:00:00"),
  duration: 15,
};
