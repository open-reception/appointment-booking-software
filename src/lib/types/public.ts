import type { supportedLocales } from "$lib/const/locales";
import type { SelectTenant } from "$lib/server/db/central-schema";
import type { SelectAgent, SelectChannel } from "$lib/server/db/tenant-schema";
import type { CalendarDateTime } from "@internationalized/date";

export type TPublicTenant = Pick<
  SelectTenant,
  "descriptions" | "id" | "links" | "logo" | "longName" | "setupState" | "shortName"
> & {
  defaultLanguage: typeof supportedLocales;
  languages: (typeof supportedLocales)[];
  address: {
    street: string;
    number: string;
    additionalAddressInfo?: string;
    zip: string;
    city: string;
  };
  requirePhone: boolean;
};

export type TPublicAppointment = {
  step:
    | "SELECT_CHANNEL"
    | "SELECT_AGENT"
    | "SELECT_SLOT"
    | "ADD_PERSONAL_DATA"
    | "LOGIN"
    | "SUMMARY"
    | "COMPLETE";
  channel?: string;
  agent?: {
    id: string;
    name: string;
    image: string | null;
  } | null;
  slot?: {
    datetime: CalendarDateTime;
    duration: number;
  };
  data?: {
    salutation: string;
    name: string;
    shareEmail: boolean;
    email: string;
    phone?: string;
    locale: string;
  };
  isNewClient?: boolean;
};

export type TPublicChannel = Pick<
  SelectChannel,
  "id" | "names" | "descriptions" | "requiresConfirmation"
>;

export type TPublicAgent = Pick<SelectAgent, "id" | "name" | "descriptions" | "image">;

export type TPublicSchedule = {
  period: {
    startDate: string;
    endDate: string;
  };
  schedule: {
    date: string; // Format YYYY-MM-DD
    channels: {
      [channelId: string]: {
        availableSlots: TPublicSlot[];
        channel: TPublicChannel;
      }[];
    };
  }[];
};

export type TPublicSlot = {
  from: string; // Format HH:mm
  to: string; // Format HH:mm
  duration: number;
  availableAgents: {
    id: string;
    name: string;
    image: string | null;
  }[];
};
