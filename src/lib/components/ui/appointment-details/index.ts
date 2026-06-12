import type { SupportedLocale } from "$lib/const/locales";
import AppointmentDetails from "./appointment-details.svelte";

export { AppointmentDetails };

export type AppointmentDetailItems = AppointmentDetailItem[];

export type AppointmentDetailItem =
  | {
      type: "date";
      value: Date | undefined;
    }
  | {
      type: "client-name";
      value: string | undefined;
    }
  | {
      type: "client-locale";
      value: SupportedLocale | undefined;
    }
  | {
      type: "client-email";
      value: string | undefined;
    }
  | {
      type: "client-phone";
      value: string | undefined;
    }
  | {
      type: "agent";
      value: string | undefined;
    };
