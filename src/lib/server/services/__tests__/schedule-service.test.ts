/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ValidationError } from "../../utils/errors";

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
};

// Helper to setup database query mocks for the exact ScheduleService query pattern
function setupDbMocks(responses: {
  channels: any[];
  slotTemplates: any[];
  appointments: any[];
  absences: any[];
  channelAgents: any[];
}) {
  let queryCallIndex = 0;

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

    // Query 4: Absences - select with where (complex date conditions)
    if (queryCallIndex === 4) {
      return {
        from: vi.fn(() => ({
          where: vi.fn(() => responses.absences),
        })),
      };
    }

    // Query 5: Channel Agents - select with innerJoin
    if (queryCallIndex === 5) {
      return {
        from: vi.fn(() => ({
          innerJoin: vi.fn(() => responses.channelAgents),
        })),
      };
    }

    // Default fallback
    return {
      from: vi.fn(() => ({
        where: vi.fn(() => []),
        innerJoin: vi.fn(() => []),
      })),
    };
  });
}

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
        startDate: "2024-01-01T00:00:00.000Z",
        endDate: "2024-01-01T23:59:59.999Z",
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
            weekdays: 1, // Monday (2^(1-1) = 1)
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
      expect(mondaySchedule.date).toBe("2024-01-01");
      expect(mondaySchedule.channels).toHaveProperty("channel1");

      const channelSchedule = mondaySchedule.channels["channel1"];
      expect(channelSchedule.channel.id).toBe("channel1");
      expect(channelSchedule.appointments).toHaveLength(0);
      expect(channelSchedule.availableSlots).toHaveLength(8); // 8 slots from 09:00-17:00

      // Validate each slot has correct times, duration, and agents
      const expectedSlots = [
        { from: "09:00", to: "10:00" },
        { from: "10:00", to: "11:00" },
        { from: "11:00", to: "12:00" },
        { from: "12:00", to: "13:00" },
        { from: "13:00", to: "14:00" },
        { from: "14:00", to: "15:00" },
        { from: "15:00", to: "16:00" },
        { from: "16:00", to: "17:00" },
      ];

      expectedSlots.forEach((expectedSlot, index) => {
        const actualSlot = channelSchedule.availableSlots[index];
        expect(actualSlot.from).toBe(expectedSlot.from);
        expect(actualSlot.to).toBe(expectedSlot.to);
        expect(actualSlot.duration).toBe(60); // 60-minute slots
        expect(actualSlot.availableAgents).toHaveLength(1);
        expect(actualSlot.availableAgents[0].id).toBe("agent1");
        expect(actualSlot.availableAgents[0].name).toBe("Test Agent");
      });
    });

    it("should handle empty channel results", async () => {
      const validRequest: ScheduleRequest = {
        startDate: "2024-01-01T00:00:00.000Z",
        endDate: "2024-01-01T23:59:59.999Z",
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
        startDate: "2024-01-01T00:00:00.000Z",
        endDate: "2024-01-01T23:59:59.999Z",
        tenantId: mockTenantId,
      };

      (mockDb.select as any).mockImplementation(() => {
        throw new Error("Database error");
      });

      await expect(service.getSchedule(validRequest)).rejects.toThrow("Database error");
    });

    it("should generate multiple days for date range", async () => {
      const validRequest: ScheduleRequest = {
        startDate: "2024-01-01T00:00:00.000Z",
        endDate: "2024-01-03T23:59:59.999Z", // 3 days
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
      expect(result.schedule[0].date).toBe("2024-01-01");
      expect(result.schedule[1].date).toBe("2024-01-02");
      expect(result.schedule[2].date).toBe("2024-01-03");
    });
  });

  describe("slot generation logic", () => {
    let service: ScheduleService;

    beforeEach(async () => {
      service = await ScheduleService.forTenant(mockTenantId);
    });

    it("should filter slots by weekday", async () => {
      const validRequest: ScheduleRequest = {
        startDate: "2024-01-01T00:00:00.000Z", // Monday
        endDate: "2024-01-01T23:59:59.999Z",
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
            weekdays: 1, // Only Monday (2^(1-1) = 1)
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
      expect(channelSchedule.availableSlots[0].from).toBe("09:00");
    });

    it("should exclude slots with appointments", async () => {
      const validRequest: ScheduleRequest = {
        startDate: "2024-01-01T00:00:00.000Z",
        endDate: "2024-01-01T23:59:59.999Z",
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
            weekdays: 1, // Monday (2^(1-1) = 1)
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
          clientId: "client1",
          channelId: "channel1",
          appointmentDate: "2024-01-01T08:00:00.000Z", // UTC time for 09:00 local time (Berlin UTC+1)
          expiryDate: "2024-01-01",
          title: "Test Appointment",
          description: null,
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
      expect(channelSchedule.availableSlots[0].from).toBe("10:00");
    });

    it("should handle appointments correctly and reduce available slots", async () => {
      const validRequest: ScheduleRequest = {
        startDate: "2024-01-01T00:00:00.000Z", // Monday
        endDate: "2024-01-01T23:59:59.999Z",
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
            weekdays: 1, // Monday (2^(1-1) = 1)
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
          clientId: "client1",
          channelId: "channel1",
          appointmentDate: "2024-01-01T09:00:00.000Z", // 10:00 local time (Berlin UTC+1)
          expiryDate: "2024-01-01",
          title: "Appointment 1",
          description: null,
          status: "CONFIRMED",
        },
        {
          id: "appointment2",
          clientId: "client2",
          channelId: "channel1",
          appointmentDate: "2024-01-01T13:00:00.000Z", // 14:00 local time (Berlin UTC+1)
          expiryDate: "2024-01-01",
          title: "Appointment 2",
          description: null,
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
        { from: "09:00", to: "10:00" },
        { from: "11:00", to: "12:00" },
        { from: "12:00", to: "13:00" },
        { from: "13:00", to: "14:00" },
        { from: "15:00", to: "16:00" },
        { from: "16:00", to: "17:00" },
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
        startDate: "2024-01-01T00:00:00.000Z",
        endDate: "2024-01-01T23:59:59.999Z",
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
            weekdays: 1, // Monday (2^(1-1) = 1)
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
          startDate: "2024-01-01T00:00:00.000Z",
          endDate: "2024-01-01T23:59:59.999Z",
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
  });
});
