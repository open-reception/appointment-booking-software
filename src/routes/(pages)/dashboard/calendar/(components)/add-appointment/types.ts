export type TAddAppointment = {
  dateTime: Date;
  agentId?: string;
  email?: string;
  hasNoEmail?: boolean;
  shareEmail?: boolean;
  name?: string;
  phone?: string;
};

export type TAddAppointmentStep = "email" | "agent" | "client" | "summary" | "success" | "error";
