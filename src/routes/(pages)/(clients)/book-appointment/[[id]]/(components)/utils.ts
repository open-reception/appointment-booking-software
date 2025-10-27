import { goto } from "$app/navigation";
import { ROUTES } from "$lib/const/routes";
import { publicStore } from "$lib/stores/public";
import type { TPublicAppointment } from "$lib/types/public";
import { get } from "svelte/store";

export const proceed = (
  newAppointment: Partial<TPublicAppointment>,
): Partial<TPublicAppointment> => {
  const curAppointment = get(publicStore).newAppointment;
  switch (true) {
    case Boolean(newAppointment.channel) &&
      (Boolean(newAppointment.agent) || newAppointment.agent === null): {
      const updatedAppointment: TPublicAppointment = { ...newAppointment, step: "SELECT_SLOT" };
      if (!curAppointment.agent) {
        console.log("1");
        publicStore.update((state) => ({
          ...state,
          newAppointment: updatedAppointment,
        }));
      }
      return updatedAppointment;
    }
    case Boolean(newAppointment.channel): {
      const updatedAppointment: TPublicAppointment = { ...newAppointment, step: "SELECT_AGENT" };
      if (!curAppointment.channel) {
        publicStore.update((state) => ({
          ...state,
          newAppointment: updatedAppointment,
        }));
      }
      goto(`${ROUTES.BOOK_APPOINTMENT}/${newAppointment.channel}`);
      return { ...newAppointment, step: "SELECT_AGENT" };
    }
    default:
      return { ...newAppointment, step: "SELECT_CHANNEL" };
  }
};

export const resest = () => {
  goto(ROUTES.BOOK_APPOINTMENT, { invalidateAll: true });
};
