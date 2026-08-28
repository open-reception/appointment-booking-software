import { browser } from "$app/env";
import { goto } from "$app/navigation";
import { resolve } from "$app/paths";
import { ROUTES } from "$lib/const/routes";
import type { TAppointment } from "$lib/types/appointments";
import type { TEmailAppointmentReminder } from "$lib/types/emails";

export const getNextAppointments = async (tenant: string) => {
  if (!browser) return [];

  try {
    const now = new Date();
    const tomorrowEvening = new Date(now);
    tomorrowEvening.setDate(now.getDate() + 1);
    tomorrowEvening.setHours(23, 59, 59, 999);
    const params = new URLSearchParams({
      startDate: now.toISOString(),
      endDate: tomorrowEvening.toISOString(),
    });
    const res = await fetch(`/api/tenants/${tenant}/appointments?${params}`);
    const data = await res.json();

    if (res.status < 400) {
      return data.appointments as TAppointment[];
    } else {
      if (res.status === 401) {
        goto(resolve(ROUTES.LOGIN));
      } else {
        console.error("Unable to fetch next appointments", res.status, res.statusText);
      }
      return [];
    }
  } catch (err) {
    console.error("Failed to fetch next appointments", err);
    return [];
  }
};

export const sendAppointmentReminders = async (
  tenant: string,
  appointments: TEmailAppointmentReminder[],
) => {
  if (!browser) return false;

  try {
    const res = await fetch(`/api/tenants/${tenant}/send-emails`, {
      method: "POST",
      body: JSON.stringify({ emails: appointments }),
    });

    if (res.status < 400) {
      return true;
    } else {
      if (res.status === 401) {
        goto(resolve(ROUTES.LOGIN));
      } else {
        console.error("Unable to send appointment reminders", res.status, res.statusText);
      }
      return false;
    }
  } catch (err) {
    console.error("Failed to send appointment reminders", err);
    return false;
  }
};
