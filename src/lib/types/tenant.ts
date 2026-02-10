import type { SelectTenant } from "$lib/server/db/central-schema";

export type TTenant = Pick<
  SelectTenant,
  "id" | "shortName" | "languages" | "setupState" | "domain"
> & {
  logo: string | null;
};

export type TTenantSettings = Omit<SelectTenant, "databaseUrl" | "setupState" | "logo"> & {
  languages: string[];
  defaultLanguage: string;
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
    autoDeleteDays: number;
    requirePhone: boolean;
  };
};
