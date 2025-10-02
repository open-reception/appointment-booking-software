/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "../+server";
import type { RequestEvent } from "@sveltejs/kit";

// Mock dependencies
vi.mock("$lib/server/services/schedule-service", () => ({
  ScheduleService: {
    forTenant: vi.fn(),
  },
}));

vi.mock("$lib/logger", () => ({
  default: {
    setContext: vi.fn(() => ({
      debug: vi.fn(),
      error: vi.fn(),
    })),
  },
}));

import { ScheduleService } from "$lib/server/services/schedule-service";

describe("Schedule API Route", () => {
  const mockTenantId = "123e4567-e89b-12d3-a456-426614174000";
  const mockScheduleService = {
    getSchedule: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (ScheduleService.forTenant as any).mockResolvedValue(mockScheduleService);
  });

  function createMockRequestEvent(overrides: Partial<RequestEvent> = {}): RequestEvent {
    const searchParams = new URLSearchParams();
    searchParams.set("startDate", "2024-01-01T00:00:00.000Z");
    searchParams.set("endDate", "2024-01-07T23:59:59.999Z");

    return {
      params: { id: mockTenantId },
      url: {
        searchParams,
      } as any,
      locals: { user: null } as any, // Public endpoint, no authentication required
      ...overrides,
    } as RequestEvent;
  }

  describe("GET /api/tenants/[id]/schedule", () => {
    it("should return schedule for valid date range (client-friendly format)", async () => {
      const mockSchedule = {
        period: {
          startDate: "2024-01-01T00:00:00.000Z",
          endDate: "2024-01-07T23:59:59.999Z",
        },
        schedule: [
          {
            date: "2024-01-01",
            channels: {
              "channel-1": {
                channel: {
                  id: "channel-1",
                  names: { en: "Support", de: "Unterstützung" },
                  descriptions: { en: "Support Channel", de: "Support Kanal" },
                  pause: false,
                  requiresConfirmation: false,
                },
                appointments: [
                  { id: "appointment-1", appointmentDate: "2024-01-01T10:00:00.000Z" },
                ],
                availableSlots: [
                  {
                    from: "09:00",
                    to: "09:30",
                    duration: 30,
                    availableAgents: [{ id: "agent-1", name: "Agent 1" }],
                  },
                ],
              },
            },
          },
        ],
      };

      const expectedClientResponse = {
        period: {
          startDate: "2024-01-01T00:00:00.000Z",
          endDate: "2024-01-07T23:59:59.999Z",
        },
        schedule: [
          {
            date: "2024-01-01",
            channels: {
              "channel-1": {
                channel: {
                  id: "channel-1",
                  names: { en: "Support", de: "Unterstützung" },
                  descriptions: { en: "Support Channel", de: "Support Kanal" },
                  pause: false,
                  requiresConfirmation: false,
                },
                availableSlots: [
                  {
                    from: "09:00",
                    to: "09:30",
                    duration: 30,
                    availableAgentCount: 1,
                  },
                ],
              },
            },
          },
        ],
      };

      mockScheduleService.getSchedule.mockResolvedValue(mockSchedule);

      const event = createMockRequestEvent();
      const response = await GET(event);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(expectedClientResponse);
      expect(mockScheduleService.getSchedule).toHaveBeenCalledWith({
        tenantId: mockTenantId,
        startDate: "2024-01-01T00:00:00.000Z",
        endDate: "2024-01-07T23:59:59.999Z",
      });
    });

    it("should handle missing tenant ID", async () => {
      const event = createMockRequestEvent({
        params: { id: undefined },
      });

      const response = await GET(event);
      const data = await response.json();

      expect(response.status).toBe(422);
      expect(data.error).toBe("Tenant ID is required");
    });

    it("should handle missing startDate parameter", async () => {
      const searchParams = new URLSearchParams();
      searchParams.set("endDate", "2024-01-07T23:59:59.999Z");

      const event = createMockRequestEvent({
        url: { searchParams } as any,
      });

      const response = await GET(event);
      const data = await response.json();

      expect(response.status).toBe(422);
      expect(data.error).toBe("Both startDate and endDate query parameters are required");
    });

    it("should handle missing endDate parameter", async () => {
      const searchParams = new URLSearchParams();
      searchParams.set("startDate", "2024-01-01T00:00:00.000Z");

      const event = createMockRequestEvent({
        url: { searchParams } as any,
      });

      const response = await GET(event);
      const data = await response.json();

      expect(response.status).toBe(422);
      expect(data.error).toBe("Both startDate and endDate query parameters are required");
    });

    it("should handle invalid date format", async () => {
      const searchParams = new URLSearchParams();
      searchParams.set("startDate", "invalid-date");
      searchParams.set("endDate", "2024-01-07T23:59:59.999Z");

      const event = createMockRequestEvent({
        url: { searchParams } as any,
      });

      const response = await GET(event);
      const data = await response.json();

      expect(response.status).toBe(422);
      expect(data.error).toBe(
        "Invalid date format. Use ISO 8601 format with timezone (YYYY-MM-DDTHH:mm:ss.sssZ or YYYY-MM-DDTHH:mm:ss±HH:mm)",
      );
    });

    it("should handle startDate after endDate", async () => {
      const searchParams = new URLSearchParams();
      searchParams.set("startDate", "2024-01-07T00:00:00.000Z");
      searchParams.set("endDate", "2024-01-01T23:59:59.999Z");

      const event = createMockRequestEvent({
        url: { searchParams } as any,
      });

      const response = await GET(event);
      const data = await response.json();

      expect(response.status).toBe(422);
      expect(data.error).toBe("Start date must be before end date");
    });

    it("should handle date range exceeding 90 days", async () => {
      const searchParams = new URLSearchParams();
      searchParams.set("startDate", "2024-01-01T00:00:00.000Z");
      searchParams.set("endDate", "2024-04-01T23:59:59.999Z"); // More than 90 days

      const event = createMockRequestEvent({
        url: { searchParams } as any,
      });

      const response = await GET(event);
      const data = await response.json();

      expect(response.status).toBe(422);
      expect(data.error).toBe("Date range cannot exceed 90 days");
    });

    it("should handle service errors gracefully", async () => {
      mockScheduleService.getSchedule.mockRejectedValue(new Error("Database connection failed"));

      const event = createMockRequestEvent();
      const response = await GET(event);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Internal server error");
    });

    it("should work without authentication (public endpoint)", async () => {
      const mockSchedule = {
        period: {
          startDate: "2024-01-01T00:00:00.000Z",
          endDate: "2024-01-07T23:59:59.999Z",
        },
        schedule: [],
      };

      mockScheduleService.getSchedule.mockResolvedValue(mockSchedule);

      const event = createMockRequestEvent({
        locals: { user: null } as any,
      });

      const response = await GET(event);

      expect(response.status).toBe(200);
      expect(mockScheduleService.getSchedule).toHaveBeenCalled();
    });

    it("should handle different timezone formats", async () => {
      const searchParams = new URLSearchParams();
      searchParams.set("startDate", "2024-01-01T00:00:00+01:00");
      searchParams.set("endDate", "2024-01-07T23:59:59+01:00");

      const mockSchedule = {
        period: {
          startDate: "2024-01-01T00:00:00+01:00",
          endDate: "2024-01-07T23:59:59+01:00",
        },
        schedule: [],
      };

      mockScheduleService.getSchedule.mockResolvedValue(mockSchedule);

      const event = createMockRequestEvent({
        url: { searchParams } as any,
      });

      const response = await GET(event);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockSchedule);
    });

    it("should handle maximum allowed date range (90 days)", async () => {
      const startDate = "2024-01-01T00:00:00.000Z";
      const endDate = "2024-03-31T23:59:59.999Z"; // Exactly 90 days

      const searchParams = new URLSearchParams();
      searchParams.set("startDate", startDate);
      searchParams.set("endDate", endDate);

      const mockSchedule = {
        period: { startDate, endDate },
        schedule: [],
      };

      mockScheduleService.getSchedule.mockResolvedValue(mockSchedule);

      const event = createMockRequestEvent({
        url: { searchParams } as any,
      });

      const response = await GET(event);

      expect(response.status).toBe(200);
      expect(mockScheduleService.getSchedule).toHaveBeenCalledWith({
        tenantId: mockTenantId,
        startDate,
        endDate,
      });
    });
  });
});
