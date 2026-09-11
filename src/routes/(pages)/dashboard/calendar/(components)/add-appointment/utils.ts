import { hashEmail } from "$lib/client/appointment-crypto";
import { fetchClientTunnels } from "../../../staff/(components)/utils";

export const getClientTunnel = async (tenantId: string, email: string) => {
  const tunnels = await fetchClientTunnels(tenantId);
  const hashedEmail = await hashEmail(email);
  const tunnel = tunnels.find((t) => t.emailHash === hashedEmail);
  return tunnel;
};
