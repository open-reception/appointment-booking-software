import { getTenantDb } from "../db";
import * as tenantSchema from "../db/tenant-schema";
import {
  type SelectAgent,
  type SelectChannel,
  type SelectSlotTemplate,
  type SelectAppointment,
  type SelectAgentAbsence,
} from "../db/tenant-schema";

import { eq, and, between, sql, or, inArray } from "drizzle-orm";
import logger from "$lib/logger";
import { z } from "zod";
import { ValidationError } from "../utils/errors";

const scheduleRequestSchema = z.object({
  startDate: z.string().datetime({ offset: true }), // ISO date string with timezone
  endDate: z.string().datetime({ offset: true }), // ISO date string with timezone
  tenantId: z.string().uuid({ message: "Invalid tenant ID format" }),
  channelId: z.string().uuid({ message: "Invalid channel ID format" }).optional(),
  agentId: z.string().uuid({ message: "Invalid agent ID format" }).optional(),
  staffUserId: z.string().uuid({ message: "Invalid staff user ID format" }).optional(),
});

export type ScheduleRequest = z.infer<typeof scheduleRequestSchema>;

export interface TimeSlot {
  from: string; // HH:MM format
  to: string; // HH:MM format
  duration: number; // minutes
  availableAgents: SelectAgent[];
}

export interface AppointmentWithKeyShare extends SelectAppointment {
  staffKeyShare?: string;
}

export interface DaySchedule {
  date: string; // YYYY-MM-DD format
  channels: {
    [channelId: string]: {
      channel: SelectChannel;
      appointments: AppointmentWithKeyShare[];
      availableSlots: TimeSlot[];
    };
  };
}

export interface ScheduleResult {
  period: {
    startDate: string;
    endDate: string;
  };
  schedule: DaySchedule[];
}

export class ScheduleService {
  #db: Awaited<ReturnType<typeof getTenantDb>> | null = null;

  private constructor(public readonly tenantId: string) {}

  /**
   * Create a schedule service for a specific tenant
   * @param tenantId The ID of the tenant
   * @returns new ScheduleService instance
   */
  static async forTenant(tenantId: string) {
    const log = logger.setContext("ScheduleService");
    log.debug("Creating schedule service for tenant", { tenantId });

    try {
      const service = new ScheduleService(tenantId);
      service.#db = await getTenantDb(tenantId);

      log.debug("Schedule service created successfully", { tenantId });
      return service;
    } catch (error) {
      log.error("Failed to create schedule service", { tenantId, error: String(error) });
      throw error;
    }
  }

  /**
   * Generate calendar view for a specific time period
   * @param request Schedule request with date range
   * @returns Schedule result with available slots and appointments
   */
  async getSchedule(request: ScheduleRequest): Promise<ScheduleResult> {
    const log = logger.setContext("ScheduleService");

    const validation = scheduleRequestSchema.safeParse(request);
    if (!validation.success) {
      throw new ValidationError("Invalid schedule request");
    }

    log.debug("Generating schedule", {
      tenantId: this.tenantId,
      startDate: request.startDate,
      endDate: request.endDate,
    });

    try {
      const db = await this.getDb();

      // 1. Get all channels for the tenant
      let channels = await db
        .select()
        .from(tenantSchema.channel)
        .where(
          and(eq(tenantSchema.channel.pause, false), eq(tenantSchema.channel.archived, false)),
        ); // Only active channels
      if (request.channelId) {
        channels = channels.filter((channel) => channel.id === request.channelId);
      }

      // 2. Get all slot templates associated with channels
      const slotTemplates = await db
        .select({
          slotTemplate: tenantSchema.slotTemplate,
          channelId: tenantSchema.channelSlotTemplate.channelId,
        })
        .from(tenantSchema.slotTemplate)
        .innerJoin(
          tenantSchema.channelSlotTemplate,
          eq(tenantSchema.slotTemplate.id, tenantSchema.channelSlotTemplate.slotTemplateId),
        );

      // 3. Get appointments in the date range
      const appointments = await db
        .select()
        .from(tenantSchema.appointment)
        .where(
          and(
            between(
              tenantSchema.appointment.appointmentDate,
              new Date(request.startDate),
              new Date(request.endDate),
            ),
            or(
              eq(tenantSchema.appointment.status, "NEW"),
              eq(tenantSchema.appointment.status, "CONFIRMED"),
              eq(tenantSchema.appointment.status, "HELD"),
            ),
          ),
        );

      // 3a. If staffUserId is provided, get staffKeyShares for all appointment tunnels
      let staffKeyShares: Record<string, string> = {};
      if (request.staffUserId && appointments.length > 0) {
        const tunnelIds = [...new Set(appointments.map((apt) => apt.tunnelId))];
        const keyShares = await db
          .select()
          .from(tenantSchema.clientTunnelStaffKeyShare)
          .where(
            and(
              eq(tenantSchema.clientTunnelStaffKeyShare.userId, request.staffUserId),
              inArray(tenantSchema.clientTunnelStaffKeyShare.tunnelId, tunnelIds),
            ),
          );

        // Create a map of tunnelId -> encryptedTunnelKey
        staffKeyShares = keyShares.reduce(
          (acc, share) => {
            acc[share.tunnelId] = share.encryptedTunnelKey;
            return acc;
          },
          {} as Record<string, string>,
        );
      }

      // 4. Get agent absences in the date range
      const absences = await db
        .select()
        .from(tenantSchema.agentAbsence)
        .where(
          or(
            // Absence starts within period
            and(
              sql`${tenantSchema.agentAbsence.startDate} >= ${request.startDate}`,
              sql`${tenantSchema.agentAbsence.startDate} <= ${request.endDate}`,
            ),
            // Absence ends within period
            and(
              sql`${tenantSchema.agentAbsence.endDate} >= ${request.startDate}`,
              sql`${tenantSchema.agentAbsence.endDate} <= ${request.endDate}`,
            ),
            // Absence spans entire period
            and(
              sql`${tenantSchema.agentAbsence.startDate} <= ${request.startDate}`,
              sql`${tenantSchema.agentAbsence.endDate} >= ${request.endDate}`,
            ),
          ),
        );

      // 5. Get channel-agent assignments
      let channelAgents = await db
        .select({
          channelId: tenantSchema.channelAgent.channelId,
          agent: tenantSchema.agent,
        })
        .from(tenantSchema.channelAgent)
        .innerJoin(
          tenantSchema.agent,
          eq(tenantSchema.channelAgent.agentId, tenantSchema.agent.id),
        );
      if (request.agentId) {
        channelAgents = channelAgents.filter((ca) => ca.agent.id === request.agentId);
      }

      // 6. Generate daily schedules
      const schedule = await this.generateDailySchedules({
        startDate: new Date(request.startDate),
        endDate: new Date(request.endDate),
        channels,
        slotTemplates,
        appointments,
        absences,
        channelAgents,
        staffKeyShares,
      });

      log.debug("Schedule generated successfully", {
        tenantId: this.tenantId,
        daysGenerated: schedule.length,
      });

      return {
        period: {
          startDate: request.startDate,
          endDate: request.endDate,
        },
        schedule,
      };
    } catch (error) {
      log.error("Failed to generate schedule", {
        tenantId: this.tenantId,
        error: String(error),
      });
      throw error;
    }
  }

  /**
   * Generate daily schedules for the given period and data
   */
  private async generateDailySchedules({
    startDate,
    endDate,
    channels,
    slotTemplates,
    appointments,
    absences,
    channelAgents,
    staffKeyShares,
  }: {
    startDate: Date;
    endDate: Date;
    channels: SelectChannel[];
    slotTemplates: { slotTemplate: SelectSlotTemplate; channelId: string }[];
    appointments: SelectAppointment[];
    absences: SelectAgentAbsence[];
    channelAgents: { channelId: string; agent: SelectAgent }[];
    staffKeyShares: Record<string, string>;
  }): Promise<DaySchedule[]> {
    const dailySchedules: DaySchedule[] = [];

    // Iterate through each day in the period
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const dateString = currentDate.toISOString().split("T")[0]; // YYYY-MM-DD
      const weekday = currentDate.getDay(); // 0 = Sunday, 1 = Monday, ...
      const weekdayBit = weekday === 0 ? 64 : Math.pow(2, weekday - 1); // Convert to bitmask

      const daySchedule: DaySchedule = {
        date: dateString,
        channels: {},
      };

      // Process each channel
      for (const channel of channels) {
        // Get appointments for this channel on this day
        const dayAppointments = appointments
          .filter(
            (appointment) =>
              appointment.channelId === channel.id &&
              (typeof appointment.appointmentDate === "string"
                ? (appointment.appointmentDate as string).startsWith(dateString)
                : appointment.appointmentDate.toISOString().startsWith(dateString)),
          )
          .map((appointment) => ({
            ...appointment,
            staffKeyShare: staffKeyShares[appointment.tunnelId],
          }));

        // Get slot templates for this channel that apply to this weekday
        const channelSlotTemplates = slotTemplates
          .filter(
            (st) =>
              st.channelId === channel.id &&
              st.slotTemplate.weekdays !== null &&
              (st.slotTemplate.weekdays & weekdayBit) !== 0,
          )
          .map((st) => st.slotTemplate);

        // Get agents assigned to this channel
        const channelAgentsList = channelAgents
          .filter((ca) => ca.channelId === channel.id)
          .map((ca) => ca.agent);

        // Generate available slots for this channel
        const availableSlots = this.generateAvailableSlots({
          date: currentDate,
          slotTemplates: channelSlotTemplates,
          appointments: dayAppointments,
          agents: channelAgentsList,
          absences,
        });

        daySchedule.channels[channel.id] = {
          channel,
          appointments: dayAppointments,
          availableSlots,
        };
      }

      dailySchedules.push(daySchedule);

      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return dailySchedules;
  }

  /**
   * Generate available time slots for a specific day and channel
   */
  private generateAvailableSlots({
    date,
    slotTemplates,
    appointments,
    agents,
    absences,
  }: {
    date: Date;
    slotTemplates: SelectSlotTemplate[];
    appointments: SelectAppointment[];
    agents: SelectAgent[];
    absences: SelectAgentAbsence[];
  }): TimeSlot[] {
    const availableSlots: TimeSlot[] = [];

    for (const template of slotTemplates) {
      // Parse template times
      const [fromHour, fromMinute] = template.from.split(":").map(Number);
      const [toHour, toMinute] = template.to.split(":").map(Number);

      // Generate slots based on duration
      const slotDuration = template.duration;
      let currentTime = fromHour * 60 + fromMinute; // minutes from midnight
      const endTime = toHour * 60 + toMinute;

      while (currentTime + slotDuration <= endTime) {
        const slotStartHour = Math.floor(currentTime / 60);
        const slotStartMinute = currentTime % 60;
        const slotEndTime = currentTime + slotDuration;
        const slotEndHour = Math.floor(slotEndTime / 60);
        const slotEndMinute = slotEndTime % 60;

        const slotStart = `${slotStartHour.toString().padStart(2, "0")}:${slotStartMinute.toString().padStart(2, "0")}`;
        const slotEnd = `${slotEndHour.toString().padStart(2, "0")}:${slotEndMinute.toString().padStart(2, "0")}`;

        // Check if this slot conflicts with any appointments
        const hasAppointmentConflict = appointments.some((appointment) => {
          const appointmentTime = new Date(appointment.appointmentDate).toTimeString().slice(0, 5);
          return appointmentTime === slotStart;
        });

        if (!hasAppointmentConflict) {
          // Get available agents for this slot (not absent)
          const availableAgents = agents.filter((agent) => {
            return !this.isAgentAbsent(agent.id, date, slotStart, slotEnd, absences);
          });

          // Only include slot if there are available agents
          if (availableAgents.length > 0) {
            availableSlots.push({
              from: slotStart,
              to: slotEnd,
              duration: slotDuration,
              availableAgents,
            });
          }
        }

        currentTime += slotDuration;
      }
    }

    return availableSlots;
  }

  /**
   * Check if an agent is absent during a specific time slot
   */
  private isAgentAbsent(
    agentId: string,
    date: Date,
    slotStart: string,
    slotEnd: string,
    absences: SelectAgentAbsence[],
  ): boolean {
    const dateString = date.toISOString().split("T")[0];
    const slotStartDateTime = new Date(`${dateString}T${slotStart}:00.000Z`);
    const slotEndDateTime = new Date(`${dateString}T${slotEnd}:00.000Z`);

    return absences.some((absence) => {
      if (absence.agentId !== agentId) return false;

      const absenceStart = new Date(absence.startDate);
      const absenceEnd = new Date(absence.endDate);

      // For time-specific absences, check if the time slot overlaps
      return (
        (slotStartDateTime >= absenceStart && slotStartDateTime < absenceEnd) ||
        (slotEndDateTime > absenceStart && slotEndDateTime <= absenceEnd) ||
        (slotStartDateTime <= absenceStart && slotEndDateTime >= absenceEnd)
      );
    });
  }

  /**
   * Get the tenant's database connection (cached)
   */
  private async getDb() {
    if (!this.#db) {
      this.#db = await getTenantDb(this.tenantId);
    }
    return this.#db;
  }
}
