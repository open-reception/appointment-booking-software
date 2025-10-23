import type { supportedLocales } from "$lib/const/locales";
import type { SelectTenant } from "$lib/server/db/central-schema";
import type { SelectChannel } from "$lib/server/db/tenant-schema";

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
  channel?: string;
  agent?: string;
};

export type TPublicChannel = Pick<SelectChannel, "id" | "names" | "descriptions">;
