import type { EMAIL_TYPE } from "$lib/const/email";

export type TEmailAppointmentReminder = {
  type: typeof EMAIL_TYPE.APPOINTMENT_REMINDER;
  appointment: {
    id: string;
    name: string;
    email: string;
    locale: string;
  };
};
