import type { ClientTunnelResponse } from "$lib/server/services/appointment-service";

export type TAddAppointment = {
  dateTime: Date;
  agentId?: string;
  email?: string;
  hasNoEmail?: boolean;
  shareEmail?: boolean;
  name?: string;
  phone?: string;
  tunnel?: ClientTunnelResponse;
  locale?: string;
};

export type TAddAppointmentStep = "email" | "agent" | "client" | "summary" | "success" | "error";
