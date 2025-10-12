import type { SelectTenant } from "$lib/server/db/central-schema";

export type TTenant = Pick<SelectTenant, "id" | "shortName" | "languages" | "setupState">;

export type TTenantSettings = Omit<SelectTenant, "databaseUrl" | "setupState" | "logo"> & {
  logo: string | undefined;
  address: {
    street: string;
    number: string;
    additionalAddressInfo?: string;
    zip: string;
    city: string;
  };
  legal: {
    website?: string;
    imprint?: string;
    privacyStatement?: string;
  };
  settings: {
    languages: string[];
    defaultLanguage: string;
    autoDeleteDays: number;
    requirePhone: boolean;
  };
};
