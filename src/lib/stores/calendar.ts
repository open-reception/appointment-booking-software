import type { AppointmentData } from "$lib/client/appointment-crypto";
import { openDialog } from "$lib/components/ui/responsive-dialog";
import type { TCalendarItem, TCalendarSlot } from "$lib/types/calendar";
import { writable } from "svelte/store";

export type CurAppointmentItem = {
  appointment: TCalendarItem;
  decrypted: AppointmentData;
};

interface CalendarState {
  curItem: CurAppointmentItem | null;
  curEmptySlot: TCalendarSlot | null;
}

const createCalendarStore = () => {
  const store = writable<CalendarState>({
    curItem: null,
    curEmptySlot: null,
  });

  return {
    ...store,
    setCurItem: (curItem: CurAppointmentItem | null) => {
      store.update((state) => {
        return { ...state, curItem };
      });

      if (curItem) {
        openDialog("current-calendar-item");
      }
    },
    setCurSlot: (curEmptySlot: TCalendarSlot | null) => {
      store.update((state) => {
        return { ...state, curEmptySlot };
      });

      if (curEmptySlot) {
        openDialog("current-calendar-slot");
      }
    },
  };
};

export const calendarStore = createCalendarStore();
