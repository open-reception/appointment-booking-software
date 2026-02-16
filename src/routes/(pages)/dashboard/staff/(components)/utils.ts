import { m } from "$i18n/messages";
import type { TStaff } from "$lib/types/users";

export const roles = [
  { label: m["staff.roles.STAFF"](), value: "STAFF" },
  { label: m["staff.roles.TENANT_ADMIN"](), value: "TENANT_ADMIN" },
  { label: m["staff.roles.GLOBAL_ADMIN"](), value: "GLOBAL_ADMIN" },
] as const;

export const permissions: { label: string; roles: TStaff["role"][] }[] = [
  { label: m["staff.permissions.agents"](), roles: ["TENANT_ADMIN", "GLOBAL_ADMIN"] },
  { label: m["staff.permissions.channels"](), roles: ["TENANT_ADMIN", "GLOBAL_ADMIN"] },
  { label: m["staff.permissions.absences"](), roles: ["STAFF", "TENANT_ADMIN", "GLOBAL_ADMIN"] },
  { label: m["staff.permissions.settings"](), roles: ["TENANT_ADMIN", "GLOBAL_ADMIN"] },
  { label: m["staff.permissions.staff"](), roles: ["TENANT_ADMIN", "GLOBAL_ADMIN"] },
  { label: m["staff.permissions.appointments"](), roles: ["TENANT_ADMIN", "STAFF"] },
];
