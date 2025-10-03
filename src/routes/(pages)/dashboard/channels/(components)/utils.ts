import { m } from "$i18n/messages";
import type { TNewSlotTemplate } from "$lib/types/channel";

const DEFAULT_SLOT_TEMPLATE: TNewSlotTemplate = {
  name: "test",
  weekdays: 31,
  from: "09:00:00",
  to: "17:00:00",
  duration: 15,
};

export const generateSlotTemplate = (index: number) => {
  return {
    ...DEFAULT_SLOT_TEMPLATE,
    name: m["components.slotTemplate.template"]({ no: index + 1 }),
  };
};
