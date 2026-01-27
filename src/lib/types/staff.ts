import type { SelectUser } from "$lib/server/db/central-schema";

export type TStaff = Pick<SelectUser, "id" | "name" | "role" | "email">;
