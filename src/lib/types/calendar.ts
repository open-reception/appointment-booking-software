import type { CalendarAgent, DaySchedule } from "$lib/server/services/schedule-service";

export type AppointmentStatus = "available" | "booked" | "reserved" | "rejected";
export type TAppointmentFilter = "all" | AppointmentStatus;

export type TCalendar = {
  period: {
    startDate: string; // ISO date-time string
    endDate: string; // ISO date-time string
  };
  calendar: DaySchedule[];
};

export type TCalendarMode =
  | TCalendarModeView
  | TCalendarModeFollowUp
  | TCalendarModeMove
  | TCalendarModeAddAfterFail;

export type TCalendarModeView = {
  mode: "VIEW";
};

export type TCalendarModeMove = {
  mode: "MOVE";
  channelId: string;
  agentId: string | undefined;
  appointmentId: string;
  appointment: TAppointmentInClipboard;
};

export type TCalendarModeFollowUp = {
  mode: "ADD_FOLLOW_UP";
  appointment: TAppointmentInClipboard;
};

export type TCalendarModeAddAfterFail = {
  mode: "ADD_AFTER_FAIL";
  channelId: string;
  appointment: TAppointmentInClipboard;
};

export type TAppointmentInClipboard = {
  shareEmail: boolean;
  hasNoEmail: boolean;
  name: string;
  locale: string;
  email?: string;
  phone?: string;
  dateTime?: Date;
};

export type TCalendarItem = TCalendarSlot & {
  appointment?: {
    dateTime: Date;
    encryptedPayload: string | null;
    tunnelId: string;
    agentId: string;
    staffKeyShare?: string;
    iv?: string;
    authTag?: string;
  };
};

export type TCalendarSlot = {
  date: string; // YYYY-MM-DD
  id: string;
  start: string; // UTC ISO date-time string
  duration: number; // in minutes
  status: AppointmentStatus;
  color: string | null;
  column: number;
  channelId: string;
  availableAgents?: CalendarAgent[];
};
