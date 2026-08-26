/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ValidationError } from "../../utils/errors";

// Set timezone to UTC for consistent test behavior
process.env.TZ = "UTC";

// Mock dependencies before imports
vi.mock("../../db", () => ({
  getTenantDb: vi.fn(),
}));

vi.mock("$lib/logger", () => ({
  default: {
    setContext: vi.fn(() => ({
      debug: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    })),
  },
}));

// Import after mocking
import { ScheduleService, type ScheduleRequest } from "../schedule-service";
import { getTenantDb } from "../../db";

// Mock database operations with proper query chain handling
const mockDb = {
  select: vi.fn(),
  delete: vi.fn(() => ({
    where: vi.fn(() => Promise.resolve()),
  })),
  insert: vi.fn(() => ({
    values: vi.fn(() => ({
      onConflictDoUpdate: vi.fn(() => Promise.resolve()),
    })),
  })),
};

// Helper to setup database query mocks for the exact ScheduleService query pattern
function setupDbMocks(responses: {
  channels: any[];
  slotTemplates: any[];
  appointments: any[];
  absences: any[];
  channelAgents: any[];
  scheduleCache?: any[];
  keyShares?: any[];
}) {
  let queryCallIndex = 0;
  const hasKeyShareQuery = typeof responses.keyShares !== "undefined";

  (mockDb.select as any).mockImplementation(() => {
    queryCallIndex++;

    // Query 1: Channels - simple select with where
    if (queryCallIndex === 1) {
      return {
        from: vi.fn(() => ({
          where: vi.fn(() => responses.channels),
        })),
      };
    }

    // Query 2: Slot Templates - select with innerJoin
    if (queryCallIndex === 2) {
      return {
        from: vi.fn(() => ({
          innerJoin: vi.fn(() => responses.slotTemplates),
        })),
      };
    }

    // Query 3: Appointments - select with where (complex conditions)
    if (queryCallIndex === 3) {
      return {
        from: vi.fn(() => ({
          where: vi.fn(() => responses.appointments),
        })),
      };
    }

    // Query 3a (optional): staff key shares - select with where
    if (hasKeyShareQuery && queryCallIndex === 4) {
      return {
        from: vi.fn(() => ({
          where: vi.fn(() => responses.keyShares ?? []),
        })),
      };
    }

    // Query 4: Absences - select with where (complex date conditions)
    const absencesQueryIndex = hasKeyShareQuery ? 5 : 4;
    if (queryCallIndex === absencesQueryIndex) {
      return {
        from: vi.fn(() => ({
          where: vi.fn(() => responses.absences),
        })),
      };
    }

    // Query 5: Channel Agents - select with innerJoin
    const channelAgentsQueryIndex = hasKeyShareQuery ? 6 : 5;
    if (queryCallIndex === channelAgentsQueryIndex) {
      return {
        from: vi.fn(() => ({
          innerJoin: vi.fn(() => responses.channelAgents),
        })),
      };
    }

    // Query 6+: Schedule cache lookup - select with where().orderBy()
    const firstCacheQueryIndex = hasKeyShareQuery ? 7 : 6;
    if (queryCallIndex >= firstCacheQueryIndex) {
      return {
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            orderBy: vi.fn(() => responses.scheduleCache ?? []),
          })),
        })),
      };
    }

    // Default fallback
    return {
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn(() => []),
        })),
        innerJoin: vi.fn(() => []),
      })),
    };
  });
}

const january1stNextYear = new Date();
january1stNextYear.setFullYear(january1stNextYear.getFullYear() + 1);
january1stNextYear.setMonth(0);
january1stNextYear.setDate(1);
const jan1stNextYearString = january1stNextYear.toISOString().split("T")[0];

const jan2ndNextYear = new Date(january1stNextYear);
jan2ndNextYear.setDate(january1stNextYear.getDate() + 1);
const jan2ndNextYearString = jan2ndNextYear.toISOString().split("T")[0];

const jan3rdNextYear = new Date(january1stNextYear);
jan3rdNextYear.setDate(january1stNextYear.getDate() + 2);
const jan3rdNextYearString = jan3rdNextYear.toISOString().split("T")[0];

const weekdayJan1stNextYear = january1stNextYear.getUTCDay();
const bitmaskForJan1stNextYear =
  weekdayJan1stNextYear === 0 ? 64 : Math.pow(2, weekdayJan1stNextYear - 1);

describe("ScheduleService", () => {
  const mockTenantId = "123e4567-e89b-12d3-a456-426614174000";

  beforeEach(() => {
    vi.clearAllMocks();
    (getTenantDb as any).mockResolvedValue(mockDb);
    // Reset the mock to ensure clean state
    (mockDb.select as any).mockClear();
  });

  describe("forTenant", () => {
    it("should create a schedule service instance", async () => {
      const service = await ScheduleService.forTenant(mockTenantId);

      expect(service).toBeInstanceOf(ScheduleService);
      expect(service.tenantId).toBe(mockTenantId);
      expect(getTenantDb).toHaveBeenCalledWith(mockTenantId);
    });

    it("should throw error if database connection fails", async () => {
      (getTenantDb as any).mockRejectedValue(new Error("Database connection failed"));

      await expect(ScheduleService.forTenant(mockTenantId)).rejects.toThrow(
        "Database connection failed",
      );
    });
  });

  describe("getSchedule", () => {
    let service: ScheduleService;

    beforeEach(async () => {
      service = await ScheduleService.forTenant(mockTenantId);
    });

    it("should validate schedule request", async () => {
      const invalidRequest = {
        startDate: "invalid-date",
        endDate: "2024-01-02T00:00:00.000Z",
        tenantId: "invalid-uuid",
      };

      await expect(service.getSchedule(invalidRequest as ScheduleRequest)).rejects.toThrow(
        ValidationError,
      );
    });

    it("should generate schedule for valid date range", async () => {
      const validRequest: ScheduleRequest = {
        startDate: `${jan1stNextYearString}T00:00:00.000Z`,
        endDate: `${jan1stNextYearString}T23:59:59.999Z`,
        timeZone: "Europe/Berlin",
        tenantId: mockTenantId,
      };

      // Mock database responses
      const mockChannels = [
        {
          id: "channel1",
          names: ["Test Channel"],
          pause: false,
          descriptions: ["Test Description"],
          languages: ["de"],
          isPublic: true,
          requiresConfirmation: false,
          color: "#ff0000",
        },
      ];

      const mockSlotTemplates = [
        {
          slotTemplate: {
            id: "template1",
            weekdays: bitmaskForJan1stNextYear,
            from: "09:00",
            to: "17:00",
            duration: 60,
          },
          channelId: "channel1",
        },
      ];

      const mockAppointments: any[] = [];
      const mockAbsences: any[] = [];
      const mockChannelAgents = [
        {
          channelId: "channel1",
          agent: {
            id: "agent1",
          },
        },
      ];

      // Setup mock database responses
      setupDbMocks({
        channels: mockChannels,
        slotTemplates: mockSlotTemplates,
        appointments: mockAppointments,
        absences: mockAbsences,
        channelAgents: mockChannelAgents,
      });

      const result = await service.getSchedule(validRequest);

      // Validate basic structure
      expect(result).toHaveProperty("period");
      expect(result.period.startDate).toBe(validRequest.startDate);
      expect(result.period.endDate).toBe(validRequest.endDate);
      expect(result).toHaveProperty("schedule");
      expect(Array.isArray(result.schedule)).toBe(true);
      expect(result.schedule).toHaveLength(1); // One day

      // Validate Monday schedule with 8 slots from 09:00-17:00
      const mondaySchedule = result.schedule[0];
      expect(mondaySchedule.date).toBe(`${jan1stNextYearString}`);
      expect(mondaySchedule.channels).toHaveProperty("channel1");

      const channelSchedule = mondaySchedule.channels["channel1"];
      expect(channelSchedule.channel.id).toBe("channel1");
      expect(channelSchedule.appointments).toHaveLength(0);
      expect(channelSchedule.availableSlots).toHaveLength(8); // 8 slots from 09:00-17:00

      // Validate each slot has correct times, duration, and agents
      const expectedSlots = [
        {
          from: `${jan1stNextYearString}T09:00:00.000Z`,
          to: `${jan1stNextYearString}T10:00:00.000Z`,
        },
        {
          from: `${jan1stNextYearString}T10:00:00.000Z`,
          to: `${jan1stNextYearString}T11:00:00.000Z`,
        },
        {
          from: `${jan1stNextYearString}T11:00:00.000Z`,
          to: `${jan1stNextYearString}T12:00:00.000Z`,
        },
        {
          from: `${jan1stNextYearString}T12:00:00.000Z`,
          to: `${jan1stNextYearString}T13:00:00.000Z`,
        },
        {
          from: `${jan1stNextYearString}T13:00:00.000Z`,
          to: `${jan1stNextYearString}T14:00:00.000Z`,
        },
        {
          from: `${jan1stNextYearString}T14:00:00.000Z`,
          to: `${jan1stNextYearString}T15:00:00.000Z`,
        },
        {
          from: `${jan1stNextYearString}T15:00:00.000Z`,
          to: `${jan1stNextYearString}T16:00:00.000Z`,
        },
        {
          from: `${jan1stNextYearString}T16:00:00.000Z`,
          to: `${jan1stNextYearString}T17:00:00.000Z`,
        },
      ];

      expectedSlots.forEach((expectedSlot, index) => {
        const actualSlot = channelSchedule.availableSlots[index];
        expect(actualSlot.from).toBe(expectedSlot.from);
        expect(actualSlot.to).toBe(expectedSlot.to);
        expect(actualSlot.duration).toBe(60); // 60-minute slots
        expect(actualSlot.availableAgents).toHaveLength(1);
        expect(actualSlot.availableAgents[0].id).toBe("agent1");
      });
    });

    it("should handle empty channel results", async () => {
      const validRequest: ScheduleRequest = {
        startDate: `${jan1stNextYearString}T00:00:00.000Z`,
        endDate: `${jan1stNextYearString}T23:59:59.999Z`,
        timeZone: "Europe/Berlin",
        tenantId: mockTenantId,
      };

      // Setup mock database responses with empty data
      setupDbMocks({
        channels: [],
        slotTemplates: [],
        appointments: [],
        absences: [],
        channelAgents: [],
      });

      const result = await service.getSchedule(validRequest);

      expect(result.schedule).toHaveLength(1); // One day
      expect(result.schedule[0].channels).toEqual({});
    });

    it("should handle database errors", async () => {
      const validRequest: ScheduleRequest = {
        startDate: `${jan1stNextYearString}T00:00:00.000Z`,
        endDate: `${jan1stNextYearString}T23:59:59.999Z`,
        timeZone: "Europe/Berlin",
        tenantId: mockTenantId,
      };

      (mockDb.select as any).mockImplementation(() => {
        throw new Error("Database error");
      });

      await expect(service.getSchedule(validRequest)).rejects.toThrow("Database error");
    });

    it("should generate multiple days for date range", async () => {
      const validRequest: ScheduleRequest = {
        startDate: `${jan1stNextYearString}T00:00:00.000Z`,
        endDate: `${jan3rdNextYear.toISOString()}`, // 3 days
        timeZone: "Europe/Berlin",
        tenantId: mockTenantId,
      };

      // Setup mock database responses with empty data
      setupDbMocks({
        channels: [],
        slotTemplates: [],
        appointments: [],
        absences: [],
        channelAgents: [],
      });

      const result = await service.getSchedule(validRequest);

      expect(result.schedule).toHaveLength(3); // Three days
      expect(result.schedule[0].date).toBe(`${jan1stNextYearString}`);
      expect(result.schedule[1].date).toBe(`${jan2ndNextYearString}`);
      expect(result.schedule[2].date).toBe(`${jan3rdNextYearString}`);
    });
  });

  describe("slot generation logic", () => {
    let service: ScheduleService;

    beforeEach(async () => {
      service = await ScheduleService.forTenant(mockTenantId);
    });

    it("should filter slots by weekday", async () => {
      const validRequest: ScheduleRequest = {
        startDate: `${jan1stNextYearString}T00:00:00.000Z`, // Monday
        endDate: `${jan1stNextYearString}T23:59:59.999Z`,
        timeZone: "Europe/Berlin",
        tenantId: mockTenantId,
      };

      const mockChannels = [
        {
          id: "channel1",
          names: ["Test Channel"],
          pause: false,
          descriptions: ["Test Description"],
          languages: ["de"],
          isPublic: true,
          requiresConfirmation: false,
          color: "#ff0000",
        },
      ];

      const mockSlotTemplates = [
        {
          slotTemplate: {
            id: "template1",
            weekdays: bitmaskForJan1stNextYear,
            from: "09:00",
            to: "10:00",
            duration: 60,
          },
          channelId: "channel1",
        },
        {
          slotTemplate: {
            id: "template2",
            weekdays: 2, // Only Tuesday (2^(2-1) = 2)
            from: "14:00",
            to: "15:00",
            duration: 60,
          },
          channelId: "channel1",
        },
      ];

      const mockChannelAgents = [
        {
          channelId: "channel1",
          agent: {
            id: "agent1",
            name: "Test Agent",
            description: null,
            logo: null,
          },
        },
      ];

      // Setup mock database responses
      setupDbMocks({
        channels: mockChannels,
        slotTemplates: mockSlotTemplates,
        appointments: [],
        absences: [],
        channelAgents: mockChannelAgents,
      });

      const result = await service.getSchedule(validRequest);

      // Should only have Monday slot (09:00-10:00), not Tuesday slot
      const channelSchedule = result.schedule[0].channels["channel1"];
      expect(channelSchedule.availableSlots).toHaveLength(1);
      expect(channelSchedule.availableSlots[0].from).toBe(`${jan1stNextYearString}T09:00:00.000Z`);
    });

    it("should exclude slots with appointments", async () => {
      const validRequest: ScheduleRequest = {
        startDate: `${jan1stNextYearString}T00:00:00.000Z`,
        endDate: `${jan1stNextYearString}T23:59:59.999Z`,
        timeZone: "Europe/Berlin",
        tenantId: mockTenantId,
      };

      const mockChannels = [
        {
          id: "channel1",
          names: ["Test"],
          pause: false,
          descriptions: ["Test"],
          languages: ["de"],
          isPublic: true,
          requiresConfirmation: false,
          color: null,
        },
      ];

      const mockSlotTemplates = [
        {
          slotTemplate: {
            id: "template1",
            weekdays: bitmaskForJan1stNextYear,
            from: "09:00",
            to: "11:00",
            duration: 60,
          },
          channelId: "channel1",
        },
      ];

      const mockAppointments = [
        {
          id: "appointment1",
          tunnelId: "tunnel1",
          channelId: "channel1",
          agentId: "agent1",
          appointmentDate: `${jan1stNextYearString}T09:00:00.000Z`, // 09:00 UTC
          duration: 60,
          status: "NEW",
        },
      ];

      const mockChannelAgents = [
        {
          channelId: "channel1",
          agent: {
            id: "agent1",
            name: "Agent",
            description: null,
            logo: null,
          },
        },
      ];

      // Setup mock database responses
      setupDbMocks({
        channels: mockChannels,
        slotTemplates: mockSlotTemplates,
        appointments: mockAppointments,
        absences: [],
        channelAgents: mockChannelAgents,
      });

      const result = await service.getSchedule(validRequest);

      const channelSchedule = result.schedule[0].channels["channel1"];
      // Should only have 10:00-11:00 slot, not 09:00-10:00 (has appointment)
      expect(channelSchedule.availableSlots).toHaveLength(1);
      expect(channelSchedule.availableSlots[0].from).toBe(`${jan1stNextYearString}T10:00:00.000Z`);
    });

    it("should handle appointments correctly and reduce available slots", async () => {
      const validRequest: ScheduleRequest = {
        startDate: `${jan1stNextYearString}T00:00:00.000Z`, // Monday
        endDate: `${jan1stNextYearString}T23:59:59.999Z`,
        timeZone: "Europe/Berlin",
        tenantId: mockTenantId,
      };

      const mockChannels = [
        {
          id: "channel1",
          names: ["Test Channel"],
          pause: false,
          descriptions: ["Test Description"],
          languages: ["de"],
          isPublic: true,
          requiresConfirmation: false,
          color: "#ff0000",
        },
      ];

      const mockSlotTemplates = [
        {
          slotTemplate: {
            id: "template1",
            weekdays: bitmaskForJan1stNextYear,
            from: "09:00",
            to: "17:00",
            duration: 60,
          },
          channelId: "channel1",
        },
      ];

      // Two existing appointments: 10:00-11:00 and 14:00-15:00
      const mockAppointments = [
        {
          id: "appointment1",
          tunnelId: "tunnel1",
          channelId: "channel1",
          agentId: "agent1",
          appointmentDate: `${jan1stNextYearString}T10:00:00.000Z`, // 10:00 UTC
          duration: 60,
          status: "CONFIRMED",
        },
        {
          id: "appointment2",
          tunnelId: "tunnel2",
          channelId: "channel1",
          agentId: "agent1",
          appointmentDate: `${jan1stNextYearString}T14:00:00.000Z`, // 14:00 UTC
          duration: 60,
          status: "NEW",
        },
      ];

      const mockChannelAgents = [
        {
          channelId: "channel1",
          agent: {
            id: "agent1",
            name: "Test Agent",
            description: "Test Description",
            logo: null,
          },
        },
      ];

      // Setup mock database responses
      setupDbMocks({
        channels: mockChannels,
        slotTemplates: mockSlotTemplates,
        appointments: mockAppointments,
        absences: [],
        channelAgents: mockChannelAgents,
      });

      const result = await service.getSchedule(validRequest);

      // Validate appointments are returned
      const channelSchedule = result.schedule[0].channels["channel1"];
      expect(channelSchedule.appointments).toHaveLength(2);
      expect(channelSchedule.appointments[0].id).toBe("appointment1");
      expect(channelSchedule.appointments[1].id).toBe("appointment2");

      // Should have 6 available slots (8 original - 2 booked)
      expect(channelSchedule.availableSlots).toHaveLength(6);

      // Validate available slots exclude booked times (10:00-11:00 and 14:00-15:00)
      const expectedAvailableSlots = [
        {
          from: `${jan1stNextYearString}T09:00:00.000Z`,
          to: `${jan1stNextYearString}T10:00:00.000Z`,
        },
        {
          from: `${jan1stNextYearString}T11:00:00.000Z`,
          to: `${jan1stNextYearString}T12:00:00.000Z`,
        },
        {
          from: `${jan1stNextYearString}T12:00:00.000Z`,
          to: `${jan1stNextYearString}T13:00:00.000Z`,
        },
        {
          from: `${jan1stNextYearString}T13:00:00.000Z`,
          to: `${jan1stNextYearString}T14:00:00.000Z`,
        },
        {
          from: `${jan1stNextYearString}T15:00:00.000Z`,
          to: `${jan1stNextYearString}T16:00:00.000Z`,
        },
        {
          from: `${jan1stNextYearString}T16:00:00.000Z`,
          to: `${jan1stNextYearString}T17:00:00.000Z`,
        },
      ];

      expectedAvailableSlots.forEach((expectedSlot, index) => {
        const actualSlot = channelSchedule.availableSlots[index];
        expect(actualSlot.from).toBe(expectedSlot.from);
        expect(actualSlot.to).toBe(expectedSlot.to);
        expect(actualSlot.duration).toBe(60);
        expect(actualSlot.availableAgents).toHaveLength(1);
        expect(actualSlot.availableAgents[0].id).toBe("agent1");
      });
    });

    it("should exclude slots when all agents are absent", async () => {
      const validRequest: ScheduleRequest = {
        startDate: `${jan1stNextYearString}T00:00:00.000Z`,
        endDate: `${jan1stNextYearString}T23:59:59.999Z`,
        timeZone: "Europe/Berlin",
        tenantId: mockTenantId,
      };

      const mockChannels = [
        {
          id: "channel1",
          names: ["Test"],
          pause: false,
          descriptions: ["Test"],
          languages: ["de"],
          isPublic: true,
          requiresConfirmation: false,
          color: null,
        },
      ];

      const mockSlotTemplates = [
        {
          slotTemplate: {
            id: "template1",
            weekdays: bitmaskForJan1stNextYear,
            from: "09:00",
            to: "10:00",
            duration: 60,
          },
          channelId: "channel1",
        },
      ];

      const mockAbsences = [
        {
          id: "absence1",
          agentId: "agent1",
          startDate: `${jan1stNextYearString}T00:00:00.000Z`,
          endDate: `${jan1stNextYearString}T23:59:59.999Z`,
          absenceType: "Urlaub",
          description: null,
          isFullDay: true,
        },
      ];

      const mockChannelAgents = [
        {
          channelId: "channel1",
          agent: {
            id: "agent1",
            name: "Agent",
            description: null,
            logo: null,
          },
        },
      ];

      // Setup mock database responses
      setupDbMocks({
        channels: mockChannels,
        slotTemplates: mockSlotTemplates,
        appointments: [],
        absences: mockAbsences,
        channelAgents: mockChannelAgents,
      });

      const result = await service.getSchedule(validRequest);

      const channelSchedule = result.schedule[0].channels["channel1"];
      // Should have no available slots since only agent is absent
      expect(channelSchedule.availableSlots).toHaveLength(0);
    });

    it("should keep slot if one agent is booked but another is available", async () => {
      const validRequest: ScheduleRequest = {
        startDate: `${jan1stNextYearString}T00:00:00.000Z`,
        endDate: `${jan1stNextYearString}T23:59:59.999Z`,
        timeZone: "Europe/Berlin",
        tenantId: mockTenantId,
      };

      const mockChannels = [
        {
          id: "channel1",
          names: ["Test"],
          pause: false,
          descriptions: ["Test"],
          languages: ["de"],
          isPublic: true,
          requiresConfirmation: false,
          color: null,
        },
      ];

      const mockSlotTemplates = [
        {
          slotTemplate: {
            id: "template1",
            weekdays: bitmaskForJan1stNextYear,
            from: "09:00",
            to: "10:00",
            duration: 60,
          },
          channelId: "channel1",
        },
      ];

      const mockAppointments = [
        {
          id: "appointment1",
          tunnelId: "tunnel1",
          channelId: "channel1",
          agentId: "agent1",
          appointmentDate: `${jan1stNextYearString}T09:00:00.000Z`,
          duration: 60,
          status: "CONFIRMED",
        },
      ];

      const mockChannelAgents = [
        {
          channelId: "channel1",
          agent: {
            id: "agent1",
            name: "Agent 1",
            description: null,
            logo: null,
          },
        },
        {
          channelId: "channel1",
          agent: {
            id: "agent2",
            name: "Agent 2",
            description: null,
            logo: null,
          },
        },
      ];

      setupDbMocks({
        channels: mockChannels,
        slotTemplates: mockSlotTemplates,
        appointments: mockAppointments,
        absences: [],
        channelAgents: mockChannelAgents,
      });

      const result = await service.getSchedule(validRequest);

      const channelSchedule = result.schedule[0].channels["channel1"];
      expect(channelSchedule.availableSlots).toHaveLength(1);
      expect(channelSchedule.availableSlots[0].from).toBe(`${jan1stNextYearString}T09:00:00.000Z`);
      expect(channelSchedule.availableSlots[0].availableAgents).toHaveLength(1);
      expect(channelSchedule.availableSlots[0].availableAgents[0].id).toBe("agent2");
    });

    it("should block same agent across channels at the same time", async () => {
      const validRequest: ScheduleRequest = {
        startDate: `${jan1stNextYearString}T00:00:00.000Z`,
        endDate: `${jan1stNextYearString}T23:59:59.999Z`,
        timeZone: "Europe/Berlin",
        tenantId: mockTenantId,
      };

      const mockChannels = [
        {
          id: "channel1",
          names: ["Channel 1"],
          pause: false,
          descriptions: ["Channel 1"],
          languages: ["de"],
          isPublic: true,
          requiresConfirmation: false,
          color: null,
        },
        {
          id: "channel2",
          names: ["Channel 2"],
          pause: false,
          descriptions: ["Channel 2"],
          languages: ["de"],
          isPublic: true,
          requiresConfirmation: false,
          color: null,
        },
      ];

      const mockSlotTemplates = [
        {
          slotTemplate: {
            id: "template1",
            weekdays: bitmaskForJan1stNextYear,
            from: "09:00",
            to: "11:00",
            duration: 60,
          },
          channelId: "channel1",
        },
        {
          slotTemplate: {
            id: "template2",
            weekdays: bitmaskForJan1stNextYear,
            from: "09:00",
            to: "11:00",
            duration: 60,
          },
          channelId: "channel2",
        },
      ];

      const mockAppointments = [
        {
          id: "appointment1",
          tunnelId: "tunnel1",
          channelId: "channel1",
          agentId: "agent1",
          appointmentDate: `${jan1stNextYearString}T10:00:00.000Z`,
          duration: 60,
          status: "CONFIRMED",
        },
      ];

      const mockChannelAgents = [
        {
          channelId: "channel1",
          agent: {
            id: "agent1",
            name: "Agent 1",
            description: null,
            logo: null,
          },
        },
        {
          channelId: "channel2",
          agent: {
            id: "agent1",
            name: "Agent 1",
            description: null,
            logo: null,
          },
        },
      ];

      setupDbMocks({
        channels: mockChannels,
        slotTemplates: mockSlotTemplates,
        appointments: mockAppointments,
        absences: [],
        channelAgents: mockChannelAgents,
      });

      const result = await service.getSchedule(validRequest);

      const channel1Schedule = result.schedule[0].channels["channel1"];
      const channel2Schedule = result.schedule[0].channels["channel2"];

      expect(channel1Schedule.availableSlots).toHaveLength(1);
      expect(channel1Schedule.availableSlots[0].from).toBe(`${jan1stNextYearString}T09:00:00.000Z`);

      expect(channel2Schedule.availableSlots).toHaveLength(1);
      expect(channel2Schedule.availableSlots[0].from).toBe(`${jan1stNextYearString}T09:00:00.000Z`);
    });

    it("should exclude slots where an agent has a recurring absence", async () => {
      const validRequest: ScheduleRequest = {
        startDate: `${jan1stNextYearString}T00:00:00.000Z`,
        endDate: `${jan1stNextYearString}T23:59:59.999Z`,
        timeZone: "Europe/Berlin",
        tenantId: mockTenantId,
      };

      const mockChannels = [
        {
          id: "channel1",
          names: ["Test"],
          pause: false,
          descriptions: ["Test"],
          languages: ["de"],
          isPublic: true,
          requiresConfirmation: false,
          color: null,
        },
      ];

      const mockSlotTemplates = [
        {
          slotTemplate: {
            id: "template1",
            weekdays: bitmaskForJan1stNextYear,
            from: "09:00",
            to: "12:00",
            duration: 60,
          },
          channelId: "channel1",
        },
      ];

      const mockAbsences = [
        {
          id: "absence1",
          type: "RECURRING",
          agentId: "agent1",
          startDate: `${jan1stNextYearString}T00:00:00.000Z`,
          endDate: `${jan1stNextYearString}T23:59:59.999Z`,
          absenceType: "Urlaub",
          description: null,
          weekdays: bitmaskForJan1stNextYear,
          from: "09:00",
          to: "10:00",
        },
      ];

      const mockChannelAgents = [
        {
          channelId: "channel1",
          agent: {
            id: "agent1",
            name: "Agent",
            description: null,
            logo: null,
          },
        },
      ];

      // Setup mock database responses
      setupDbMocks({
        channels: mockChannels,
        slotTemplates: mockSlotTemplates,
        appointments: [],
        absences: mockAbsences,
        channelAgents: mockChannelAgents,
      });

      console.log("validRequest", validRequest);
      console.log("mockAbsences", mockAbsences);
      const result = await service.getSchedule(validRequest);

      const channelSchedule = result.schedule[0].channels["channel1"];
      expect(channelSchedule.availableSlots).toHaveLength(2);
      expect(channelSchedule.availableSlots).toStrictEqual([
        {
          availableAgents: [
            {
              description: null,
              id: "agent1",
              logo: null,
              name: "Agent",
            },
          ],
          duration: 60,
          from: `${jan1stNextYearString}T10:00:00.000Z`,
          to: `${jan1stNextYearString}T11:00:00.000Z`,
        },
        {
          availableAgents: [
            {
              description: null,
              id: "agent1",
              logo: null,
              name: "Agent",
            },
          ],
          duration: 60,
          from: `${jan1stNextYearString}T11:00:00.000Z`,
          to: `${jan1stNextYearString}T12:00:00.000Z`,
        },
      ]);
    });
  });

  describe("cache management", () => {
    let service: ScheduleService;

    beforeEach(async () => {
      service = await ScheduleService.forTenant(mockTenantId);
    });

    it("should clean cache and rebuild synchronously when awaitRebuild is true", async () => {
      const startDate = new Date(`${jan1stNextYearString}T00:00:00.000Z`);
      const endDate = new Date(`${jan2ndNextYearString}T23:59:59.999Z`);

      (mockDb.select as any).mockReturnValue({
        from: vi.fn(() => ({
          groupBy: vi.fn(() => [{ timezone: "UTC" }, { timezone: "Europe/Berlin" }]),
        })),
      });

      const deleteWhere = vi.fn(() => Promise.resolve());
      (mockDb.delete as any).mockReturnValue({
        where: deleteWhere,
      });

      const getScheduleSpy = vi.spyOn(service, "getSchedule").mockResolvedValue({
        period: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        },
        schedule: [],
      });

      await service.cleanAndRegenerateCache({
        startDate,
        endDate,
        channelId: "channel-123",
        awaitRebuild: true,
      });

      expect(deleteWhere).toHaveBeenCalledTimes(1);
      expect(getScheduleSpy).toHaveBeenCalledTimes(2);
      expect(getScheduleSpy).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          tenantId: mockTenantId,
          channelId: "channel-123",
          timeZone: "UTC",
        }),
      );
      expect(getScheduleSpy).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          tenantId: mockTenantId,
          channelId: "channel-123",
          timeZone: "Europe/Berlin",
        }),
      );
    });

    it("should cap rebuild end date to max allowed horizon", async () => {
      const startDate = new Date(`${jan1stNextYearString}T00:00:00.000Z`);
      const veryFarEndDate = new Date("3000-01-01T00:00:00.000Z");

      (mockDb.select as any).mockReturnValue({
        from: vi.fn(() => ({
          groupBy: vi.fn(() => [{ timezone: "UTC" }]),
        })),
      });

      (mockDb.delete as any).mockReturnValue({
        where: vi.fn(() => Promise.resolve()),
      });

      const getScheduleSpy = vi.spyOn(service, "getSchedule").mockResolvedValue({
        period: {
          startDate: startDate.toISOString(),
          endDate: veryFarEndDate.toISOString(),
        },
        schedule: [],
      });

      await service.cleanAndRegenerateCache({
        startDate,
        endDate: veryFarEndDate,
        channelId: "channel-123",
        awaitRebuild: true,
      });

      const now = new Date();
      const maxEndDate = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 14, 0, 23, 59, 59, 999),
      );

      expect(getScheduleSpy).toHaveBeenCalledTimes(1);
      expect(new Date(getScheduleSpy.mock.calls[0][0].endDate).toISOString()).toBe(
        maxEndDate.toISOString(),
      );
    });

    it("should clean cache and trigger background rebuild when awaitRebuild is false", async () => {
      const startDate = new Date(`${jan1stNextYearString}T00:00:00.000Z`);
      const endDate = new Date(`${jan2ndNextYearString}T23:59:59.999Z`);

      (mockDb.select as any).mockReturnValue({
        from: vi.fn(() => ({
          groupBy: vi.fn(() => [{ timezone: "UTC" }]),
        })),
      });

      const deleteWhere = vi.fn(() => Promise.resolve());
      (mockDb.delete as any).mockReturnValue({
        where: deleteWhere,
      });

      const getScheduleSpy = vi.spyOn(service, "getSchedule").mockResolvedValue({
        period: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        },
        schedule: [],
      });

      await service.cleanAndRegenerateCache({
        startDate,
        endDate,
        channelId: "channel-123",
      });

      // Background rebuild starts immediately even though it is not awaited.
      await Promise.resolve();

      expect(deleteWhere).toHaveBeenCalledTimes(1);
      expect(getScheduleSpy).toHaveBeenCalledTimes(1);
    });

    it("should handle usedTimeZones errors and still clear cache", async () => {
      const startDate = new Date(`${jan1stNextYearString}T00:00:00.000Z`);
      const endDate = new Date(`${jan2ndNextYearString}T23:59:59.999Z`);

      (mockDb.select as any).mockReturnValue({
        from: vi.fn(() => ({
          groupBy: vi.fn(() => {
            throw new Error("groupBy failed");
          }),
        })),
      });

      const deleteWhere = vi.fn(() => Promise.resolve());
      (mockDb.delete as any).mockReturnValue({
        where: deleteWhere,
      });

      const getScheduleSpy = vi.spyOn(service, "getSchedule").mockResolvedValue({
        period: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        },
        schedule: [],
      });

      await service.cleanAndRegenerateCache({
        startDate,
        endDate,
        channelId: "channel-123",
        awaitRebuild: true,
      });

      expect(deleteWhere).toHaveBeenCalledTimes(1);
      expect(getScheduleSpy).not.toHaveBeenCalled();
    });

    it("should delete past cache entries", async () => {
      const deleteWhere = vi.fn(() => Promise.resolve());
      (mockDb.delete as any).mockReturnValue({
        where: deleteWhere,
      });

      await service.cleanPastCache();

      expect(mockDb.delete).toHaveBeenCalledTimes(1);
      expect(deleteWhere).toHaveBeenCalledTimes(1);
    });

    it("should generate cache ahead for all channels and used timezones", async () => {
      const getScheduleSpy = vi.spyOn(service, "getSchedule").mockResolvedValue({
        period: {
          startDate: new Date().toISOString(),
          endDate: new Date().toISOString(),
        },
        schedule: [],
      });

      let selectCall = 0;
      (mockDb.select as any).mockImplementation(() => {
        selectCall++;

        // usedTimeZones()
        if (selectCall === 1) {
          return {
            from: vi.fn(() => ({
              groupBy: vi.fn(() => [{ timezone: "UTC" }, { timezone: "Europe/Berlin" }]),
            })),
          };
        }

        // generateCacheAhead() channels query
        return {
          from: vi.fn(() => [{ id: "channel-1" }, { id: "channel-2" }]),
        };
      });

      await service.generateCacheAhead();
      await Promise.resolve();

      expect(getScheduleSpy).toHaveBeenCalledTimes(4);
      const observedCombinations = getScheduleSpy.mock.calls.map((call) => {
        const req = call[0];
        return `${req.channelId}:${req.timeZone}`;
      });

      expect(observedCombinations).toEqual(
        expect.arrayContaining([
          "channel-1:UTC",
          "channel-1:Europe/Berlin",
          "channel-2:UTC",
          "channel-2:Europe/Berlin",
        ]),
      );
    });
  });
});
