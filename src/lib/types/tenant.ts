import type { SelectTenant } from "$lib/server/db/central-schema";

export type TTenant = Pick<SelectTenant, "id" | "shortName" | "longName" | "setupState">;
