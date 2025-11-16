import type { DaySchedule } from "$lib/server/services/schedule-service";

export type AppointmentStatus = "available" | "booked" | "reserved";
export type TAppointmentFilter = "all" | AppointmentStatus;

export type TCalendar = {
  period: {
    startDate: string; // ISO date-time string
    endDate: string; // ISO date-time string
  };
  calendar: DaySchedule[];
};

export type TCalendarItem = {
  date: string; // YYYY-MM-DD
  id: string;
  start: string; // HH:mm
  duration: number; // in minutes
  status: AppointmentStatus;
  color: string | null;
  column: number;
  channelId: string;
  appointment?: {
    dateTime: Date;
    encryptedData: string | null;
    tunnelId: string;
    agentId: string;
  };
};
