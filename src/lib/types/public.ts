import type { supportedLocales } from "$lib/const/locales";
import type { SelectTenant } from "$lib/server/db/central-schema";
import type { SelectAgent, SelectChannel } from "$lib/server/db/tenant-schema";

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
  step: "SELECT_CHANNEL" | "SELECT_AGENT" | "SELECT_SLOT" | "ADD_PERSONAL_DATA" | "COMPLETE";
  channel?: string;
  agent?: {
    id: string;
    name: string;
    image: string | null;
  } | null;
};

export type TPublicAgent = Pick<SelectAgent, "id" | "name" | "descriptions" | "image">;

export type TPublicChannel = Pick<SelectChannel, "id" | "names" | "descriptions">;
