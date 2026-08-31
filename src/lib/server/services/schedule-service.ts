import { getTenantDb } from "../db";
import * as tenantSchema from "../db/tenant-schema";
import {
  type SelectAgent,
  type SelectChannel,
  type SelectSlotTemplate,
  type SelectAppointment,
  type SelectAgentAbsence,
  scheduleCache,
} from "../db/tenant-schema";

import { eq, and, between, sql, or, inArray } from "drizzle-orm";
import logger from "$lib/logger";
import { z } from "zod";
import { ValidationError } from "../utils/errors";
import { WebAuthnService } from "../auth/webauthn-service";
import { isValidTimeZone, toLocalTime, toLocalTimeIgnoringDst } from "../utils/timezone";

const CACHE_MAX_AHEAD_MONTHS = 14;

const scheduleRequestSchema = z.object({
  startDate: z.string().datetime({ offset: true }), // ISO date string with timezone
  endDate: z.string().datetime({ offset: true }), // ISO date string with timezone
  tenantId: z.string().uuid({ message: "Invalid tenant ID format" }),
  timeZone: z
    .string()
    .refine((tz) => isValidTimeZone(tz), { message: "Invalid IANA timezone format" })
    .default("UTC"),
  channelId: z.string().uuid({ message: "Invalid channel ID format" }).optional(),
  agentId: z.string().uuid({ message: "Invalid agent ID format" }).optional(),
  staffUserId: z.string().uuid({ message: "Invalid staff user ID format" }).optional(),
});

export type ScheduleRequest = z.infer<typeof scheduleRequestSchema>;

export type CalendarAgent = Pick<SelectAgent, "id">;

export interface TimeSlot {
  from: string; // UTC ISO timestamp
  to: string; // UTC ISO timestamp
  duration: number; // minutes
  availableAgents: CalendarAgent[];
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
  #buffer: Array<{
    startDate: Date;
    endDate: Date;
    channelId: string;
    timeZones: string[];
  }> = [];
  #isProcessingBuffer = false;

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
  async getSchedule(
    request: ScheduleRequest,
    passkeyId?: string | undefined,
  ): Promise<ScheduleResult> {
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
      // Tunnel keys are wrapped per passkey; scope the lookup to the passkey the user most
      // recently authenticated with (same definition getClientTunnels / key-shard use).
      const currentPasskey = request.staffUserId
        ? await WebAuthnService.getCurrentPasskey(request.staffUserId, passkeyId)
        : null;
      if (request.staffUserId && currentPasskey && appointments.length > 0) {
        const tunnelIds = [...new Set(appointments.map((apt) => apt.tunnelId))];
        const keyShares = await db
          .select()
          .from(tenantSchema.clientTunnelStaffKeyShare)
          .where(
            and(
              eq(tenantSchema.clientTunnelStaffKeyShare.userId, request.staffUserId),
              eq(tenantSchema.clientTunnelStaffKeyShare.passkeyId, currentPasskey.id),
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
              sql`${tenantSchema.agentAbsence.endDate} > now()`,
            ),
            // Absence ends within period
            and(
              sql`${tenantSchema.agentAbsence.endDate} >= ${request.startDate}`,
              sql`${tenantSchema.agentAbsence.endDate} <= ${request.endDate}`,
              sql`${tenantSchema.agentAbsence.endDate} > now()`,
            ),
            // Absence spans entire period
            and(
              sql`${tenantSchema.agentAbsence.startDate} <= ${request.startDate}`,
              sql`${tenantSchema.agentAbsence.endDate} >= ${request.endDate}`,
              sql`${tenantSchema.agentAbsence.endDate} > now()`,
            ),
          ),
        );

      // 5. Get channel-agent assignments
      let channelAgents = await db
        .select({
          channelId: tenantSchema.channelAgent.channelId,
          agent: { id: tenantSchema.agent.id },
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
        timeZone: request.timeZone,
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
    timeZone,
  }: {
    startDate: Date;
    endDate: Date;
    channels: SelectChannel[];
    slotTemplates: { slotTemplate: SelectSlotTemplate; channelId: string }[];
    appointments: SelectAppointment[];
    absences: SelectAgentAbsence[];
    channelAgents: { channelId: string; agent: CalendarAgent }[];
    staffKeyShares: Record<string, string>;
    timeZone: string;
  }): Promise<DaySchedule[]> {
    const dailySchedules: DaySchedule[] = [];

    // Iterate through each day in the period
    const currentDate = new Date(startDate);
    currentDate.setUTCHours(0, 0, 0, 0);

    const normalizedEndDate = new Date(endDate);
    normalizedEndDate.setUTCHours(23, 59, 59, 999);

    while (currentDate <= normalizedEndDate) {
      const dateString = currentDate.toISOString().split("T")[0]; // YYYY-MM-DD
      const weekday = currentDate.getUTCDay(); // 0 = Sunday, 1 = Monday, ...
      const weekdayBit = weekday === 0 ? 64 : Math.pow(2, weekday - 1); // Convert to bitmask
      const dayAppointments = appointments.filter((appointment) =>
        new Date(appointment.appointmentDate).toISOString().startsWith(dateString),
      );

      const daySchedule: DaySchedule = {
        date: dateString,
        channels: {},
      };

      // Process each channel
      for (const channel of channels) {
        // Get appointments for this channel on this day
        const dayChannelAppointments = dayAppointments
          .filter((appointment) => appointment.channelId === channel.id)
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
        const availableSlots = await this.generateAvailableSlots({
          channelId: channel.id,
          date: currentDate,
          slotTemplates: channelSlotTemplates,
          appointments: dayAppointments,
          agents: channelAgentsList,
          absences,
          timeZone,
        });

        daySchedule.channels[channel.id] = {
          channel,
          appointments: dayChannelAppointments,
          availableSlots,
        };
      }

      dailySchedules.push(daySchedule);

      // Move to next day
      currentDate.setUTCDate(currentDate.getUTCDate() + 1);
    }

    return dailySchedules;
  }

  /**
   * Generate available time slots for a specific day and channel
   */
  private async generateAvailableSlots({
    channelId,
    date,
    slotTemplates,
    appointments,
    agents,
    absences,
    timeZone,
  }: {
    channelId: string;
    date: Date;
    slotTemplates: SelectSlotTemplate[];
    appointments: SelectAppointment[];
    agents: CalendarAgent[];
    absences: SelectAgentAbsence[];
    timeZone: string;
  }): Promise<TimeSlot[]> {
    const availableSlots: TimeSlot[] = [];

    // Can I read from cache?
    const db = await this.getDb();
    const cachedSchedule = await db
      .select()
      .from(scheduleCache)
      .where(
        and(
          eq(scheduleCache.date, date.toISOString().split("T")[0]),
          eq(scheduleCache.channel, channelId),
          eq(scheduleCache.timezone, timeZone),
        ),
      )
      .orderBy(scheduleCache.date);
    if (cachedSchedule.length > 0) {
      return cachedSchedule[0].data as TimeSlot[];
    }

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

        const slotStartDateTime = new Date(
          Date.UTC(
            date.getUTCFullYear(),
            date.getUTCMonth(),
            date.getUTCDate(),
            slotStartHour,
            slotStartMinute,
            0,
            0,
          ),
        );
        const slotEndDateTime = new Date(
          Date.UTC(
            date.getUTCFullYear(),
            date.getUTCMonth(),
            date.getUTCDate(),
            slotEndHour,
            slotEndMinute,
            0,
            0,
          ),
        );

        // Do not include slots that are in the past
        if (slotEndDateTime.getTime() < new Date().getTime()) {
          currentTime += slotDuration;
          continue;
        }

        const availableAgents = agents.filter((agent) => {
          if (
            this.isAgentAbsent(agent.id, slotStartDateTime, slotEndDateTime, absences, timeZone)
          ) {
            return false;
          }

          const conflictResult = !this.hasAgentAppointmentConflict(
            agent.id,
            slotStartDateTime,
            slotEndDateTime,
            appointments,
            timeZone,
          );

          return conflictResult;
        });

        // Only include slot if there are available agents
        if (availableAgents.length > 0) {
          availableSlots.push({
            from: slotStartDateTime.toISOString(),
            to: slotEndDateTime.toISOString(),
            duration: slotDuration,
            availableAgents,
          });
        }

        currentTime += slotDuration;
      }
    }

    // Save schedule to cache
    await db
      .insert(scheduleCache)
      .values({
        date: date.toISOString().split("T")[0],
        timezone: timeZone,
        channel: channelId,
        data: availableSlots,
      })
      .onConflictDoUpdate({
        target: [scheduleCache.date, scheduleCache.timezone, scheduleCache.channel],
        set: { data: availableSlots },
      });

    return availableSlots;
  }

  /**
   * Check if an agent is absent during a specific time slot
   */
  private isAgentAbsent(
    agentId: string,
    slotStartDateTime: Date,
    slotEndDateTime: Date,
    absences: SelectAgentAbsence[],
    timeZone: string,
  ): boolean {
    return absences.some((absence) => {
      if (absence.agentId !== agentId) return false;

      function isWithin(
        localStart: Date,
        localEnd: Date,
        bitmap: number | null,
        from: string | null,
        to: string | null,
        timeZone: string,
      ): boolean {
        if (!bitmap || !from || !to) return false;

        // Build a from/to Date on the SAME local calendar day as `d`.
        const boundary = (d: Date, time: string): Date => {
          const [h, m, s] = time.split(":").map(Number);
          return new Date(
            Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), h, m, s ?? 0),
          );
        };

        const check = (d: Date): boolean => {
          // weekday in local frame (Monday = 0)
          const dayIndex = (d.getUTCDay() + 6) % 7;
          if ((bitmap & (1 << dayIndex)) === 0) return false;

          const fromDate = toLocalTimeIgnoringDst(boundary(d, from), timeZone);
          const toDate = toLocalTimeIgnoringDst(boundary(d, to), timeZone);

          return d >= fromDate && d <= toDate;
        };

        return check(localStart) && check(localEnd);
      }

      const absenceStart = toLocalTime(new Date(absence.startDate), timeZone);
      const absenceEnd = toLocalTime(new Date(absence.endDate), timeZone);
      const slotStart = toLocalTimeIgnoringDst(slotStartDateTime, timeZone);
      const slotEnd = toLocalTimeIgnoringDst(slotEndDateTime, timeZone);

      // Quick way out
      if (slotStart > absenceEnd || slotEnd < absenceStart) {
        return false; // No overlap
      }

      // For time-specific absences, check if the time slot overlaps
      const slotStartsDuringAbsence = slotStart >= absenceStart && slotStart < absenceEnd;
      const slotEndsDuringAbsence = slotEnd > absenceStart && slotEnd <= absenceEnd;
      const slotCoversEntireAbsence = slotStart <= absenceStart && slotEnd >= absenceEnd;

      switch (absence.type) {
        case "ONE_TIME": {
          return slotStartsDuringAbsence || slotEndsDuringAbsence || slotCoversEntireAbsence;
        }
        case "RECURRING": {
          return (
            (slotStartsDuringAbsence || slotEndsDuringAbsence || slotCoversEntireAbsence) &&
            isWithin(slotStart, slotEnd, absence.weekdays, absence.from, absence.to, timeZone)
          );
        }
        default:
          return true;
      }
    });
  }

  /**
   * Check if an agent already has an appointment that overlaps with a specific slot
   */
  private hasAgentAppointmentConflict(
    agentId: string,
    slotStartDateTime: Date,
    slotEndDateTime: Date,
    appointments: SelectAppointment[],
    timeZone: string,
  ): boolean {
    return appointments.some((appointment) => {
      if (appointment.agentId !== agentId) return false;

      const appointmentStart = new Date(appointment.appointmentDate);
      const appointmentDuration = Number.isFinite(appointment.duration) ? appointment.duration : 0;
      const appointmentEnd = new Date(appointmentStart.getTime() + appointmentDuration * 60 * 1000);
      const slotStart = toLocalTimeIgnoringDst(slotStartDateTime, timeZone);
      const slotEnd = toLocalTimeIgnoringDst(slotEndDateTime, timeZone);

      return (
        slotStart < toLocalTime(appointmentEnd, timeZone) &&
        slotEnd > toLocalTime(appointmentStart, timeZone)
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

  private async cleanCache({
    startDate,
    endDate,
    channelId,
  }: {
    startDate: Date;
    endDate: Date;
    channelId: string;
  }): Promise<void> {
    const db = await this.getDb();

    // If endDate is far ahead, set it to 2999-12-31 to avoid not deleting future cache entries, that have become invalid because we only generate a certain number of months ahead, but users could generate a schedule cache for dates far in the future.
    const usedEndDate =
      endDate > new Date(new Date().setMonth(new Date().getMonth() + CACHE_MAX_AHEAD_MONTHS - 2))
        ? new Date(2999, 11, 31)
        : endDate;

    await db
      .delete(scheduleCache)
      .where(
        and(
          eq(scheduleCache.channel, channelId),
          between(
            scheduleCache.date,
            startDate.toISOString().split("T")[0],
            usedEndDate.toISOString().split("T")[0],
          ),
        ),
      );
  }

  private async generateCache({
    startDate,
    endDate,
    channelId,
    timeZones,
  }: {
    startDate: Date;
    endDate: Date;
    channelId: string;
    timeZones: string[];
  }): Promise<void> {
    // Maximum end date is the last day of the month, 13 months from now
    const now = new Date();
    const maxEndDate = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth() + CACHE_MAX_AHEAD_MONTHS,
        0,
        23,
        59,
        59,
        999,
      ),
    );
    const usedEndDate = endDate > maxEndDate ? maxEndDate : endDate;

    // Add to buffer
    this.#buffer.push({
      startDate,
      endDate: usedEndDate,
      channelId,
      timeZones,
    });

    // Start buffer queue
    this.processBufferQueue();
  }

  private async processBufferQueue(): Promise<void> {
    if (this.#isProcessingBuffer || this.#buffer.length === 0) return;

    this.#isProcessingBuffer = true;
    try {
      const log = logger.setContext("ScheduleService.Buffer");
      while (this.#buffer.length > 0) {
        const { startDate, endDate, channelId, timeZones } = this.#buffer[0];
        try {
          log.debug("Generating schedule cache", {
            tenantId: this.tenantId,
            channelId,
            startDate: startDate.toISOString().split("T")[0],
            endDate: endDate.toISOString().split("T")[0],
          });

          // Generate cache for each timezone
          for (const timeZone of timeZones) {
            await this.getSchedule({
              startDate: startDate.toISOString(),
              endDate: endDate.toISOString(),
              tenantId: this.tenantId,
              channelId,
              timeZone,
            });
          }
        } catch (error) {
          log.error("Failed to generate schedule cache", {
            tenantId: this.tenantId,
            channelId,
            startDate: startDate.toISOString().split("T")[0],
            endDate: endDate.toISOString().split("T")[0],
            error: String(error),
          });
        } finally {
          // Remove the processed item from the buffer
          this.#buffer.shift();
        }
      }
    } finally {
      this.#isProcessingBuffer = false;
    }
  }

  private async usedTimeZones(): Promise<string[]> {
    try {
      // TODO: Once we have a tenant timezone setting, we can get that timezone instead of all timezones in the cache
      const db = await this.getDb();
      const timeZones = await db
        .select({ timezone: scheduleCache.timezone })
        .from(scheduleCache)
        .groupBy(scheduleCache.timezone);
      return timeZones.map((tz) => tz.timezone);
    } catch (error) {
      const log = logger.setContext("ScheduleService");
      log.error("Failed to get used time zones", {
        tenantId: this.tenantId,
        error: String(error),
      });
      return [];
    }
  }

  /**
   * Clean and regenerate cache; used after actions that will invalidate the schedule cache, such as creating or deleting appointments, or changing agent availability.
   * This method will clear the cache for the affected date range and channels, forcing a regeneration of available slots on the next request.
   * @returns Promise<void>
   */
  async cleanAndRegenerateCache({
    startDate,
    endDate,
    channelId,
    awaitRebuild,
  }: {
    startDate: Date;
    endDate: Date;
    channelId: string;
    awaitRebuild?: boolean;
  }): Promise<void> {
    const log = logger.setContext("ScheduleService");
    log.debug("Cleaning and regenerating cache", {
      tenantId: this.tenantId,
      channelId,
      startDate: startDate.toISOString().split("T")[0],
      endDate: endDate.toISOString().split("T")[0],
    });
    // Get all time zones for the channel in the cache
    const timeZones = await this.usedTimeZones();

    // Clear cache
    await this.cleanCache({ startDate, endDate, channelId });

    // Optionally wait for rebuild
    if (awaitRebuild) {
      await this.generateCache({
        startDate,
        endDate,
        channelId,
        timeZones,
      });
      return;
    }

    // Rebuild cache in the background without awaiting
    this.generateCache({
      startDate,
      endDate,
      channelId,
      timeZones,
    });
    return;
  }

  /**
   * Removes cached schedule for dates in the past
   */
  async cleanPastCache(): Promise<void> {
    const db = await this.getDb();
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    await db
      .delete(scheduleCache)
      .where(sql`${scheduleCache.date} < ${today.toISOString().split("T")[0]}`);
  }

  /**
   * Creates the cache for dates in the future
   */
  async generateCacheAhead(): Promise<void> {
    const timeZones = await this.usedTimeZones();
    const log = logger.setContext("ScheduleService");

    // Generate cache for next months
    const db = await this.getDb();
    const channels = await db.select().from(tenantSchema.channel);
    for (const channel of channels) {
      log.debug("Generating schedule cache ahead", {
        tenantId: this.tenantId,
        channelId: channel.id,
        startDate: new Date().toISOString().split("T")[0],
        endDate: new Date(new Date().setMonth(new Date().getMonth() + CACHE_MAX_AHEAD_MONTHS))
          .toISOString()
          .split("T")[0],
      });
      this.generateCache({
        startDate: new Date(),
        endDate: new Date(new Date().setMonth(new Date().getMonth() + CACHE_MAX_AHEAD_MONTHS)),
        channelId: channel.id,
        timeZones,
      });
    }
  }
}
