import { browser } from "$app/environment";
import { goto } from "$app/navigation";
import { resolve } from "$app/paths";
import { ROUTES } from "$lib/const/routes";
import { publicStore } from "$lib/stores/public";
import type { TPublicAppointment, TPublicSchedule } from "$lib/types/public";
import { CalendarDateTime, getLocalTimeZone, toZoned, today } from "@internationalized/date";
import { get } from "svelte/store";

export const proceed = (
  newAppointment: Partial<TPublicAppointment>,
): Partial<TPublicAppointment> => {
  const curAppointment = get(publicStore).newAppointment;
  switch (true) {
    case newAppointment.step === "SUMMARY": {
      const updatedAppointment: TPublicAppointment = {
        ...newAppointment,
        step: "SUMMARY",
      };
      if (curAppointment.step !== "SUMMARY") {
        publicStore.update((state) => ({
          ...state,
          newAppointment: updatedAppointment,
        }));
      }
      return updatedAppointment;
    }
    case Boolean(newAppointment.data) &&
      Boolean(newAppointment.slot) &&
      Boolean(newAppointment.channel) &&
      Boolean(newAppointment.agent): {
      const isLoggedIn = get(publicStore).crypto?.isClientAuthenticated() ?? false;
      const updatedAppointment: TPublicAppointment = {
        ...newAppointment,
        step: isLoggedIn ? "SUMMARY" : "LOGIN",
      };
      if (!curAppointment.data) {
        publicStore.update((state) => ({
          ...state,
          newAppointment: updatedAppointment,
        }));
      }
      return updatedAppointment;
    }
    case Boolean(newAppointment.slot) &&
      Boolean(newAppointment.channel) &&
      Boolean(newAppointment.agent): {
      const updatedAppointment: TPublicAppointment = {
        ...newAppointment,
        step: "ADD_PERSONAL_DATA",
      };
      if (!curAppointment.slot) {
        publicStore.update((state) => ({
          ...state,
          newAppointment: updatedAppointment,
        }));
      }
      return updatedAppointment;
    }
    case Boolean(newAppointment.channel) &&
      (Boolean(newAppointment.agent) || newAppointment.agent === null): {
      const updatedAppointment: TPublicAppointment = { ...newAppointment, step: "SELECT_SLOT" };
      if (!curAppointment.agent) {
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
      goto(resolve(`${ROUTES.BOOK_APPOINTMENT}/${newAppointment.channel}`));
      return { ...newAppointment, step: "SELECT_AGENT" };
    }
    default:
      return { ...newAppointment, step: "SELECT_CHANNEL" };
  }
};

export const resest = () => {
  goto(resolve(ROUTES.BOOK_APPOINTMENT), { invalidateAll: true });
};

export const fetchSchedule = async (opts: {
  tenant: string;
  channel: string;
  agent: string | null;
  year: number;
  month: number;
}) => {
  if (!browser) return;

  const curDate = today(getLocalTimeZone());
  const startDay = curDate.year === opts.year && curDate.month === opts.month ? curDate.day : 1;
  const startDate = new CalendarDateTime(opts.year, opts.month, startDay, 0, 0, 0, 0);
  const endDate = startDate
    .add({ months: 1 })
    .set({ day: 1 })
    .subtract({ days: 1 })
    .set({ hour: 23, minute: 59, second: 59, millisecond: 999 });

  const params = new URLSearchParams({
    startDate: toZoned(startDate, "UTC").toAbsoluteString(),
    endDate: toZoned(endDate, "UTC").toAbsoluteString(),
    channel: opts.channel,
    agent: opts.agent || "",
  });
  const res = await fetch(`/api/tenants/${opts.tenant}/schedule?${params}`, {
    method: "GET",
  });

  if (res.status < 400) {
    try {
      const data = await res.json();
      return data.schedule as TPublicSchedule["schedule"];
    } catch (error) {
      console.error("Unable to parse public agents response", error);
    }
  } else {
    console.error("Invalid public agents response");
  }
};
