import { describe, expect, it, vi, beforeEach } from "vitest";
import { GET } from "../+server";
import { ScheduleService } from "$lib/server/services/schedule-service";

// Mock the ScheduleService
vi.mock("$lib/server/services/schedule-service", () => ({
  ScheduleService: {
    forTenant: vi.fn(),
  },
}));

// Mock logger
vi.mock("$lib/logger", () => ({
  default: {
    setContext: vi.fn(() => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    })),
  },
}));

describe("Calendar API", () => {
  const mockGetSchedule = vi.fn();

  const mockScheduleService = {
    getSchedule: mockGetSchedule,
    tenantId: "tenant-123",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the mock implementation
    mockGetSchedule.mockReset();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(ScheduleService.forTenant).mockResolvedValue(mockScheduleService as any);
  });

  const createRequest = (tenantId: string, startDate?: string, endDate?: string) => {
    const url = new URL("http://localhost/api/tenants/123/calendar");
    if (startDate) url.searchParams.set("startDate", startDate);
    if (endDate) url.searchParams.set("endDate", endDate);

    return {
      params: { id: tenantId },
      url,
      locals: {}, // Add locals object
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
  };

  const mockScheduleResponse = {
    period: {
      startDate: "2024-01-01T00:00:00.000Z",
      endDate: "2024-01-02T00:00:00.000Z",
    },
    schedule: [
      {
        date: "2024-01-01",
        channels: {
          "channel-123": {
            channel: {
              id: "channel-123",
              names: { en: "Test Channel", de: "Test Kanal" },
              descriptions: { en: "Test Description", de: "Test Beschreibung" },
              color: "#FF0000",
              pause: false,
              requiresConfirmation: false,
              isPublic: true,
            },
            appointments: [
              {
                id: "appointment-123",
                appointmentDate: "2024-01-01T10:00:00.000Z",
                status: "CONFIRMED",
                channelId: "channel-123",
              },
            ],
            availableSlots: [
              {
                from: "09:00",
                to: "09:30",
                duration: 30,
                availableAgents: [
                  {
                    id: "agent-123",
                    name: "Test Agent",
                    descriptions: { en: "Test Agent Description" },
                  },
                ],
              },
              {
                from: "11:00",
                to: "11:30",
                duration: 30,
                availableAgents: [
                  {
                    id: "agent-123",
                    name: "Test Agent",
                    descriptions: { en: "Test Agent Description" },
                  },
                  {
                    id: "agent-456",
                    name: "Another Agent",
                    descriptions: { en: "Another Agent Description" },
                  },
                ],
              },
            ],
          },
        },
      },
    ],
  };

  describe("GET", () => {
    it("should return calendar with full schedule data", async () => {
      mockGetSchedule.mockResolvedValue(mockScheduleResponse);

      const request = createRequest(
        "tenant-123",
        "2024-01-01T00:00:00.000Z",
        "2024-01-02T00:00:00.000Z",
      );
      const response = await GET(request);

      expect(response.status).toBe(200);

      const responseData = await response.json();

      expect(responseData).toEqual({
        period: {
          startDate: "2024-01-01T00:00:00.000Z",
          endDate: "2024-01-02T00:00:00.000Z",
        },
        calendar: mockScheduleResponse.schedule, // Full schedule data including appointments
      });

      expect(ScheduleService.forTenant).toHaveBeenCalledWith("tenant-123");
      expect(mockGetSchedule).toHaveBeenCalledWith({
        tenantId: "tenant-123",
        startDate: "2024-01-01T00:00:00.000Z",
        endDate: "2024-01-02T00:00:00.000Z",
        staffUserId: undefined,
      });
    });

    it("should include full appointment and agent information in calendar response", async () => {
      mockGetSchedule.mockResolvedValue(mockScheduleResponse);

      const request = createRequest(
        "tenant-123",
        "2024-01-01T00:00:00.000Z",
        "2024-01-02T00:00:00.000Z",
      );
      const response = await GET(request);

      expect(response.status).toBe(200);

      const responseData = await response.json();

      // Verify that appointments are included in the response
      const channelData = responseData.calendar[0].channels["channel-123"];
      expect(channelData).toHaveProperty("appointments");
      expect(channelData.appointments).toHaveLength(1);

      // Verify that full agent information is included
      expect(channelData.availableSlots[0]).toHaveProperty("availableAgents");
      expect(channelData.availableSlots[0].availableAgents).toHaveLength(1);
    });

    it("should return 400 for missing tenant ID", async () => {
      const request = createRequest("", "2024-01-01T00:00:00.000Z", "2024-01-02T00:00:00.000Z");
      const response = await GET(request);

      expect(response.status).toBe(422);
    });

    it("should return 400 for missing startDate", async () => {
      const request = createRequest("tenant-123", undefined, "2024-01-02T00:00:00.000Z");
      const response = await GET(request);

      expect(response.status).toBe(422);
    });

    it("should return 400 for missing endDate", async () => {
      const request = createRequest("tenant-123", "2024-01-01T00:00:00.000Z", undefined);
      const response = await GET(request);

      expect(response.status).toBe(422);
    });

    it("should return 400 for invalid date format", async () => {
      const request = createRequest("tenant-123", "invalid-date", "2024-01-02T00:00:00.000Z");
      const response = await GET(request);

      expect(response.status).toBe(422);
    });

    it("should return 400 for startDate >= endDate", async () => {
      const request = createRequest(
        "tenant-123",
        "2024-01-02T00:00:00.000Z",
        "2024-01-01T00:00:00.000Z",
      );
      const response = await GET(request);

      expect(response.status).toBe(422);
    });

    it("should return 400 for date range exceeding 90 days", async () => {
      const startDate = "2024-01-01T00:00:00.000Z";
      const endDate = "2024-04-01T00:00:00.000Z"; // ~3 months

      const request = createRequest("tenant-123", startDate, endDate);
      const response = await GET(request);

      expect(response.status).toBe(422);
    });

    it("should handle ScheduleService errors", async () => {
      mockGetSchedule.mockRejectedValue(new Error("Database error"));

      const request = createRequest(
        "tenant-123",
        "2024-01-01T00:00:00.000Z",
        "2024-01-02T00:00:00.000Z",
      );
      const response = await GET(request);

      expect(response.status).toBe(500);
    });

    it("should handle empty schedule gracefully", async () => {
      const emptyScheduleResponse = {
        period: {
          startDate: "2024-01-01T00:00:00.000Z",
          endDate: "2024-01-02T00:00:00.000Z",
        },
        schedule: [],
      };

      mockGetSchedule.mockResolvedValue(emptyScheduleResponse);

      const request = createRequest(
        "tenant-123",
        "2024-01-01T00:00:00.000Z",
        "2024-01-02T00:00:00.000Z",
      );
      const response = await GET(request);

      expect(response.status).toBe(200);

      const responseData = await response.json();
      expect(responseData.calendar).toEqual([]);
    });

    it("should handle channels with no available slots", async () => {
      const scheduleWithNoSlots = {
        period: {
          startDate: "2024-01-01T00:00:00.000Z",
          endDate: "2024-01-02T00:00:00.000Z",
        },
        schedule: [
          {
            date: "2024-01-01",
            channels: {
              "channel-123": {
                channel: {
                  id: "channel-123",
                  names: { en: "Test Channel" },
                  descriptions: { en: "Test Description" },
                  color: "#FF0000",
                  pause: false,
                  requiresConfirmation: false,
                  isPublic: true,
                },
                appointments: [],
                availableSlots: [],
              },
            },
          },
        ],
      };

      mockGetSchedule.mockResolvedValue(scheduleWithNoSlots);

      const request = createRequest(
        "tenant-123",
        "2024-01-01T00:00:00.000Z",
        "2024-01-02T00:00:00.000Z",
      );
      const response = await GET(request);

      expect(response.status).toBe(200);

      const responseData = await response.json();
      expect(responseData.calendar[0].channels["channel-123"].availableSlots).toEqual([]);
    });
  });
});
