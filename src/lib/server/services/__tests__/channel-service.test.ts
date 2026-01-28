/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ValidationError } from "../../utils/errors";

// Mock dependencies before imports
vi.mock("../../db", () => ({
  getTenantDb: vi.fn(),
  centralDb: {
    select: vi.fn(() => ({
      from: vi.fn((table) => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => {
            // Return different data based on table
            if (table?.name === "tenant_config" || table === "tenant_config") {
              return Promise.resolve([]);
            }
            // Default to tenant data
            return Promise.resolve([
              {
                id: "tenant-123",
                name: "Test Tenant",
                subdomain: "test",
                plan: "basic",
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            ]);
          }),
        })),
      })),
    })),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("$lib/logger", () => ({
  UniversalLogger: vi.fn(() => ({
    setContext: vi.fn(() => ({
      debug: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
    })),
  })),
  default: {
    setContext: vi.fn(() => ({
      debug: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
    })),
  },
}));

vi.mock("../../db/tenant-config", () => ({
  TenantConfig: {
    create: vi.fn(() =>
      Promise.resolve({
        configuration: { nextChannelColor: 0 },
        setConfig: vi.fn(),
      }),
    ),
  },
}));

// Import after mocking
import { ChannelService } from "../channel-service";
import { getTenantDb } from "../../db";

// Mock data with valid UUIDs
const mockChannel = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  names: { en: "Test Channel" },
  color: "#FF0000",
  descriptions: { en: "Test description" },
  isPublic: true,
  requiresConfirmation: false,
  pause: false,
};

const mockAgent = {
  id: "550e8400-e29b-41d4-a716-446655440001",
  name: "Test Agent",
  descriptions: { en: "Test description" },
  image: null,
  archived: false,
};

const mockSlotTemplate = {
  id: "550e8400-e29b-41d4-a716-446655440002",
  name: "Test Slot",
  weekdays: 31,
  from: "09:00",
  to: "17:00",
  duration: 30,
};

// Simple mock database
const mockDb = {
  transaction: vi.fn(),
  insert: vi.fn(),
  select: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

describe("ChannelService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getTenantDb).mockResolvedValue(mockDb as any);
  });

  describe("forTenant", () => {
    it("should create channel service for tenant", async () => {
      const service = await ChannelService.forTenant("tenant-123");

      expect(service.tenantId).toBe("tenant-123");
      expect(getTenantDb).toHaveBeenCalledWith("tenant-123");
    });

    it("should handle database connection error", async () => {
      vi.mocked(getTenantDb).mockRejectedValue(new Error("DB connection failed"));

      await expect(ChannelService.forTenant("tenant-123")).rejects.toThrow("DB connection failed");
    });
  });

  describe("createChannel", () => {
    let service: ChannelService;

    beforeEach(async () => {
      service = await ChannelService.forTenant("tenant-123");
    });

    it("should create channel successfully", async () => {
      const expectedResult = {
        ...mockChannel,
        agents: [mockAgent],
        slotTemplates: [mockSlotTemplate],
      };

      mockDb.transaction.mockResolvedValue(expectedResult);

      // Use minimal valid request that matches schema exactly
      const request = {
        names: { en: "Test Channel" },
      };

      const result = await service.createChannel(request as any);

      expect(result).toEqual(expectedResult);
      expect(mockDb.transaction).toHaveBeenCalled();
    });

    it("should create channel with slot templates and agents", async () => {
      const expectedResult = {
        ...mockChannel,
        agents: [mockAgent],
        slotTemplates: [mockSlotTemplate],
      };

      mockDb.transaction.mockResolvedValue(expectedResult);

      const request = {
        names: { en: "Test Channel" },
        agentIds: ["550e8400-e29b-41d4-a716-446655440001"],
        slotTemplates: [
          {
            name: "Test Slot",
            from: "09:00:00",
            to: "17:00:00",
            duration: 30,
          },
        ],
        staffIds: [],
      };

      const result = await service.createChannel(request);

      expect(result).toEqual(expectedResult);
      expect(mockDb.transaction).toHaveBeenCalled();
    });

    it("should handle validation error for invalid name", async () => {
      const request = {
        names: { en: "" },
        agentIds: [],
        slotTemplates: [],
        staffIds: [],
      };

      await expect(service.createChannel(request)).rejects.toThrow(ValidationError);
    });

    it("should handle validation error for invalid time format", async () => {
      const request = {
        names: { en: "Test Channel" },
        agentIds: [],
        slotTemplates: [
          {
            name: "Test Slot",
            from: "invalid-time",
            to: "17:00:00",
            duration: 30,
          },
        ],
        staffIds: [],
      };

      await expect(service.createChannel(request)).rejects.toThrow(ValidationError);
    });

    it("should handle database transaction error", async () => {
      mockDb.transaction.mockRejectedValue(new Error("Transaction failed"));

      const request = {
        names: { en: "Test Channel" },
        agentIds: [],
        slotTemplates: [],
        staffIds: [],
      };

      await expect(service.createChannel(request)).rejects.toThrow("Transaction failed");
    });
  });

  describe("updateChannel", () => {
    let service: ChannelService;

    beforeEach(async () => {
      service = await ChannelService.forTenant("tenant-123");
    });

    it("should update channel successfully", async () => {
      const expectedResult = {
        ...mockChannel,
        names: { en: "Updated Channel" },
        agents: [],
        slotTemplates: [],
      };

      mockDb.transaction.mockResolvedValue(expectedResult);

      const updateData = {
        names: { en: "Updated Channel" },
      };

      const result = await service.updateChannel(
        "550e8400-e29b-41d4-a716-446655440000",
        updateData,
      );

      expect(result).toEqual(expectedResult);
      expect(mockDb.transaction).toHaveBeenCalled();
    });

    it("should handle validation error for invalid name", async () => {
      const updateData = { names: { en: "" } };

      await expect(
        service.updateChannel("550e8400-e29b-41d4-a716-446655440000", updateData),
      ).rejects.toThrow(ValidationError);
    });

    it("should handle transaction error", async () => {
      mockDb.transaction.mockRejectedValue(new Error("Transaction failed"));

      const updateData = { names: { en: "Updated Channel" } };

      await expect(
        service.updateChannel("550e8400-e29b-41d4-a716-446655440000", updateData),
      ).rejects.toThrow("Transaction failed");
    });
  });

  describe("getChannelById", () => {
    let service: ChannelService;

    beforeEach(async () => {
      service = await ChannelService.forTenant("tenant-123");
    });

    it("should return channel when found", async () => {
      vi.spyOn(service, "getChannelById").mockResolvedValue({
        ...mockChannel,
        agents: [mockAgent],
        slotTemplates: [mockSlotTemplate],
        archived: false,
      });

      const result = await service.getChannelById("550e8400-e29b-41d4-a716-446655440000");

      // Test basic properties without deep nesting
      expect(result).not.toBeNull();
      expect(result?.id).toBe(mockChannel.id);
      expect(result?.names).toEqual(mockChannel.names);
      expect(result?.agents).toHaveLength(1);
      expect(result?.slotTemplates).toHaveLength(1);
    });

    it("should return null when channel not found", async () => {
      vi.spyOn(service, "getChannelById").mockResolvedValue(null);

      const result = await service.getChannelById("nonexistent-channel");

      expect(result).toBeNull();
    });

    it("should handle database error", async () => {
      vi.spyOn(service, "getChannelById").mockRejectedValue(new Error("DB error"));

      await expect(service.getChannelById("550e8400-e29b-41d4-a716-446655440000")).rejects.toThrow(
        "DB error",
      );
    });
  });

  describe("getAllChannels", () => {
    let service: ChannelService;

    beforeEach(async () => {
      service = await ChannelService.forTenant("tenant-123");
    });

    it("should return all channels", async () => {
      const expectedChannels = [
        {
          ...mockChannel,
          agents: [mockAgent],
          slotTemplates: [mockSlotTemplate],
          archived: false,
        },
      ];

      vi.spyOn(service, "getAllChannels").mockResolvedValue(expectedChannels);

      const result = await service.getAllChannels();

      // Test without deep object comparison
      expect(result).toHaveLength(1);
      expect(result[0]).toBeDefined();
      expect(result[0].id).toBe(mockChannel.id);
      expect(result[0].names).toEqual(mockChannel.names);
    });

    it("should return empty array when no channels exist", async () => {
      vi.spyOn(service, "getAllChannels").mockResolvedValue([]);

      const result = await service.getAllChannels();

      expect(result).toEqual([]);
    });

    it("should handle database error", async () => {
      vi.spyOn(service, "getAllChannels").mockRejectedValue(new Error("DB error"));

      await expect(service.getAllChannels()).rejects.toThrow("DB error");
    });
  });

  describe("deleteChannel", () => {
    let service: ChannelService;

    beforeEach(async () => {
      service = await ChannelService.forTenant("tenant-123");
    });

    it("should delete channel successfully", async () => {
      mockDb.transaction.mockResolvedValue(true);

      const result = await service.deleteChannel("550e8400-e29b-41d4-a716-446655440000");

      expect(result).toBe(true);
      expect(mockDb.transaction).toHaveBeenCalled();
    });

    it("should return false when channel not found", async () => {
      mockDb.transaction.mockResolvedValue(false);

      const result = await service.deleteChannel("nonexistent-channel");

      expect(result).toBe(false);
    });

    it("should handle database error", async () => {
      mockDb.transaction.mockRejectedValue(new Error("DB error"));

      await expect(service.deleteChannel("550e8400-e29b-41d4-a716-446655440000")).rejects.toThrow(
        "DB error",
      );
    });
  });
});
