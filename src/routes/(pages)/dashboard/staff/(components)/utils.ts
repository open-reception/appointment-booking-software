import { m } from "$i18n/messages";
import type { ClientTunnelResponse } from "$lib/server/services/appointment-service";
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

export const fetchClientTunnels = async (tenantId: string) => {
  const resp = await fetch(`/api/tenants/${tenantId}/appointments/tunnels`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  if (!resp.ok) {
    throw new Error("❌ Unable to fetch tunnels");
  }

  const tunnelsData: { tunnels: ClientTunnelResponse[] } = await resp.json();
  return tunnelsData.tunnels;
};

export const addStaffKeyShares = async (
  tenantId: string,
  staffUserId: string,
  keyShares: { tunnelId: string; encryptedTunnelKey: string }[],
) => {
  const resp = await fetch(`/api/tenants/${tenantId}/appointments/tunnels/add-staff-key-shares`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      staffUserId,
      keyShares,
    }),
  });

  if (!resp.ok) {
    throw new Error("❌ Unable to send staff key shares");
  }

  const body: { success: boolean; skipped: number } = await resp.json();
  return resp.status < 400 && body.success;
};
