import type { SelectUser } from "$lib/server/db/central-schema";

export type TStaff = Pick<
  SelectUser,
  | "id"
  | "email"
  | "name"
  | "role"
  | "isActive"
  | "createdAt"
  | "updatedAt"
  | "lastLoginAt"
  | "confirmationState"
>;
