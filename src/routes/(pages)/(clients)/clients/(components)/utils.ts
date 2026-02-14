import { goto } from "$app/navigation";
import { resolve } from "$app/paths";
import { m } from "$i18n/messages";
import { ROUTES } from "$lib/const/routes";

export const appointmentStatusToBadge = (status: string) => {
  switch (status) {
    case "NEW":
      return { label: m["clients.appointments.types.NEW"]() };
    case "CONFIRMED":
      return { label: m["clients.appointments.types.CONFIRMED"]() };
    default:
      return null;
  }
};

// TODO: Is this needed?
export const cancelAppointmentByClient = async (opts: {
  tenant: string;
  appointment: string;
  emailHash: string;
  challengeId: string;
  challengeResponse: string;
}) => {
  const res = await fetch(
    `/api/tenants/${opts.tenant}/appointments/${opts.appointment}/delete-by-client`,
    {
      method: "DELETE",
      body: JSON.stringify({
        emailHash: opts.emailHash,
        challengeId: opts.challengeId,
        challengeResponse: opts.challengeResponse,
      }),
    },
  );

  if (res.status < 400) {
    return true;
  } else {
    if (res.status === 401) {
      goto(resolve(ROUTES.LOGIN));
    } else {
      console.error("Unable to cancel appointment", opts.appointment, res.status, res.statusText);
    }
    return false;
  }
};
