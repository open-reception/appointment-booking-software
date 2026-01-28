import { browser } from "$app/environment";
import { goto } from "$app/navigation";
import { resolve } from "$app/paths";
import { ROUTES } from "$lib/const/routes";
import { calendarStore } from "$lib/stores/calendar";
import { staffCrypto } from "$lib/stores/staff-crypto";
import type { TCalendar, TCalendarItem } from "$lib/types/calendar";
import { toCalendarDateTime, toZoned, type CalendarDate } from "@internationalized/date";
import { get } from "svelte/store";

export const fetchCalendar = async (opts: { tenant: string; startDate: CalendarDate }) => {
  if (!browser) return;

  const params = new URLSearchParams({
    startDate: toZoned(opts.startDate, "UTC").toAbsoluteString(),
    endDate: toZoned(
      toCalendarDateTime(opts.startDate).set({
        hour: 23,
        minute: 59,
        second: 59,
        millisecond: 999,
      }),
      "UTC",
    ).toAbsoluteString(),
  });
  const res = await fetch(`/api/tenants/${opts.tenant}/calendar?${params}`, {
    method: "GET",
  });

  if (res.status < 400) {
    try {
      const data = await res.json();
      return data as TCalendar;
    } catch (error) {
      console.error("Unable to parse calendar response", error);
    }
  } else {
    if (res.status === 401) {
      goto(resolve(ROUTES.LOGIN));
    } else {
      console.error("Unable to fetch calendar", res.status, res.statusText);
    }
  }
};

// Convert time string to minutes since midnight
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export function positionItems(items: TCalendarItem[] | undefined) {
  if (!items) return [];

  // Sort items by start time
  const sortedItems = [...items]
    .sort((a, b) => b.duration - a.duration)
    .sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));

  // Calculate layout positions
  const processedItems = sortedItems.map((item) => {
    const startMinutes = timeToMinutes(item.start);
    const endMinutes = startMinutes + item.duration;

    return {
      ...item,
      startMinutes,
      endMinutes,
      totalColumns: 1,
    };
  });

  // Find overlapping groups and assign columns
  for (let i = 0; i < processedItems.length; i++) {
    const currentItem = processedItems[i];
    const overlappingItems = [currentItem];

    // Find all items that overlap with current item's time range
    for (let j = i + 1; j < processedItems.length; j++) {
      const nextItem = processedItems[j];

      // Check if items overlap
      if (nextItem.startMinutes < currentItem.endMinutes) {
        overlappingItems.push(nextItem);
      } else {
        break;
      }
    }

    // Assign columns to overlapping items
    if (overlappingItems.length > 1) {
      const columns: number[] = [];

      overlappingItems.forEach((item) => {
        // Find the first available column
        let column = 0;
        while (columns[column] && columns[column] > item.startMinutes) {
          column++;
        }

        // Don't change columns back
        if (item.column !== undefined && item.column > column) {
          column = item.column;
        }

        item.column = column;
        item.totalColumns = Math.max(item.totalColumns, column + 1);
        columns[column] = item.endMinutes;
      });

      // Update totalColumns for all overlapping items
      const maxColumns = Math.max(...overlappingItems.map((item) => item.column)) + 1;
      overlappingItems.forEach((item) => {
        item.totalColumns = maxColumns;
      });
    }
  }

  return processedItems;
}

export const cancelAppointment = async (opts: {
  tenant: string;
  appointment: string;
  email?: string;
  locale: string;
}) => {
  if (!browser) return;

  let body = {};
  if (opts.email) {
    body = {
      clientEmail: opts.email,
      clientLanguage: opts.locale,
    };
  }
  const res = await fetch(`/api/tenants/${opts.tenant}/appointments/${opts.appointment}/delete`, {
    method: "DELETE",
    body: JSON.stringify(body),
  });

  if (res.status < 400) {
    return true;
  } else {
    if (res.status === 401) {
      goto(resolve(ROUTES.LOGIN));
    } else {
      console.error("Unable to delete appointment", opts, res.status, res.statusText);
    }
    return false;
  }
};

export const denyAppointment = async (opts: {
  tenant: string;
  appointment: string;
  email?: string;
  locale: string;
}) => {
  if (!browser) return;

  let body = {};
  if (opts.email) {
    body = {
      clientEmail: opts.email,
      clientLanguage: opts.locale,
    };
  }
  const res = await fetch(`/api/tenants/${opts.tenant}/appointments/${opts.appointment}/deny`, {
    method: "PUT",
    body: JSON.stringify(body),
  });

  if (res.status < 400) {
    return true;
  } else {
    if (res.status === 401) {
      goto(resolve(ROUTES.LOGIN));
    } else {
      console.error("Unable to deny appointment", opts, res.status, res.statusText);
    }
    return false;
  }
};

export const confirmAppointment = async (opts: {
  tenant: string;
  appointment: string;
  email?: string;
  locale: string;
}) => {
  if (!browser) return;

  let body = {};
  if (opts.email) {
    body = {
      clientEmail: opts.email,
      clientLanguage: opts.locale,
    };
  }
  const res = await fetch(`/api/tenants/${opts.tenant}/appointments/${opts.appointment}/confirm`, {
    method: "PUT",
    body: JSON.stringify(body),
  });

  if (res.status < 400) {
    return true;
  } else {
    if (res.status === 401) {
      goto(resolve(ROUTES.LOGIN));
    } else {
      console.error("Unable to confirm appointment", opts, res.status, res.statusText);
    }
    return false;
  }
};

export const openAppointmentById = async (
  appointments: TCalendarItem[],
  appointmentId: string,
  callback: () => void,
) => {
  const appointment = appointments?.find((i) => i.id === appointmentId);
  const staffCryptoStore = get(staffCrypto);
  if (
    staffCryptoStore.crypto &&
    appointment &&
    appointment.appointment?.encryptedPayload &&
    appointment.appointment.iv &&
    appointment.appointment.authTag &&
    appointment.appointment.staffKeyShare
  ) {
    const decrypted = await staffCryptoStore.crypto.decryptStaffAppointment({
      encryptedAppointment: {
        encryptedPayload: appointment.appointment.encryptedPayload,
        iv: appointment.appointment.iv,
        authTag: appointment.appointment.authTag,
      },
      staffKeyShare: appointment.appointment.staffKeyShare,
    });
    calendarStore.setCurItem({ appointment, decrypted });
  }

  callback();
};
