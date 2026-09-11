import type { SelectTenant } from "$lib/server/db/central-schema";
import { TENANT_FEATURE_FLAGS } from "$lib/const/tenants";

export type TTenant = Pick<
  SelectTenant,
  "id" | "shortName" | "languages" | "setupState" | "domain" | "features"
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

export type TTenantFeatureFlag = keyof typeof TENANT_FEATURE_FLAGS;
