/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies before imports
vi.mock("../../db", () => ({
  getTenantDb: vi.fn(),
  centralDb: {
    select: vi.fn(),
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

// Import after mocking
import { NotificationService, type NotificationCreationRequest } from "../notification-service";
import { getTenantDb } from "../../db";
import { ValidationError } from "../../utils/errors";

// Mock database operations
const mockDb = {
  insert: vi.fn(() => ({
    values: vi.fn(() => ({
      returning: vi.fn(),
    })),
  })),
  select: vi.fn(() => ({
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        limit: vi.fn(),
        orderBy: vi.fn(),
      })),
    })),
  })),
  update: vi.fn(() => ({
    set: vi.fn(() => ({
      where: vi.fn(),
    })),
  })),
  delete: vi.fn(() => ({
    where: vi.fn(() => ({
      returning: vi.fn(),
    })),
  })),
};

const mockNotification = {
  id: "notification-123",
  staffId: "staff-123",
  title: { en: "New Appointment", de: "Neuer Termin" },
  description: { en: "You have a new appointment", de: "Sie haben einen neuen Termin" },
  isRead: false,
};

const mockChannelStaff = [
  { staffId: "staff-123" },
  { staffId: "staff-456" },
  { staffId: "staff-789" },
];

describe("NotificationService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getTenantDb).mockResolvedValue(mockDb as any);
  });

  describe("forTenant", () => {
    it("should create notification service for tenant", async () => {
      const service = await NotificationService.forTenant("tenant-123");

      expect(service.tenantId).toBe("tenant-123");
      expect(getTenantDb).toHaveBeenCalledWith("tenant-123");
    });

    it("should handle database connection error", async () => {
      vi.mocked(getTenantDb).mockRejectedValue(new Error("DB connection failed"));

      await expect(NotificationService.forTenant("tenant-123")).rejects.toThrow(
        "DB connection failed",
      );
    });
  });

  describe("createNotification", () => {
    let service: NotificationService;

    beforeEach(async () => {
      service = await NotificationService.forTenant("tenant-123");
    });

    it("should create notifications for all staff members in channel", async () => {
      const selectChain = {
        from: vi.fn(() => ({
          where: vi.fn().mockResolvedValue(mockChannelStaff),
        })),
      };
      mockDb.select.mockReturnValue(selectChain);

      const insertChain = {
        values: vi.fn(() => ({
          returning: vi
            .fn()
            .mockResolvedValue([
              { id: "notification-1" },
              { id: "notification-2" },
              { id: "notification-3" },
            ]),
        })),
      };
      mockDb.insert.mockReturnValue(insertChain);

      const request: NotificationCreationRequest = {
        channelId: "550e8400-e29b-41d4-a716-446655440000",
        title: { en: "New Appointment", de: "Neuer Termin" },
        description: { en: "You have a new appointment", de: "Sie haben einen neuen Termin" },
      };

      const result = await service.createNotification(request);

      expect(result).toEqual(["notification-1", "notification-2", "notification-3"]);
      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.insert).toHaveBeenCalled();
      expect(insertChain.values).toHaveBeenCalledWith([
        {
          staffId: "staff-123",
          title: request.title,
          description: request.description,
          isRead: false,
        },
        {
          staffId: "staff-456",
          title: request.title,
          description: request.description,
          isRead: false,
        },
        {
          staffId: "staff-789",
          title: request.title,
          description: request.description,
          isRead: false,
        },
      ]);
    });

    it("should return empty array when no staff members found", async () => {
      const selectChain = {
        from: vi.fn(() => ({
          where: vi.fn().mockResolvedValue([]),
        })),
      };
      mockDb.select.mockReturnValue(selectChain);

      const request: NotificationCreationRequest = {
        channelId: "550e8400-e29b-41d4-a716-446655440000",
        title: { en: "New Appointment" },
        description: { en: "You have a new appointment" },
      };

      const result = await service.createNotification(request);

      expect(result).toEqual([]);
      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it("should handle validation error for invalid channel ID", async () => {
      const request = {
        channelId: "invalid-uuid",
        title: { en: "Test" },
        description: { en: "Test" },
      };

      await expect(service.createNotification(request as any)).rejects.toThrow(ValidationError);
    });

    it("should handle validation error for missing title", async () => {
      const request = {
        channelId: "550e8400-e29b-41d4-a716-446655440000",
        description: { en: "Test" },
      };

      await expect(service.createNotification(request as any)).rejects.toThrow(ValidationError);
    });

    it("should handle database error during creation", async () => {
      const selectChain = {
        from: vi.fn(() => ({
          where: vi.fn().mockResolvedValue(mockChannelStaff),
        })),
      };
      mockDb.select.mockReturnValue(selectChain);

      const insertChain = {
        values: vi.fn(() => ({
          returning: vi.fn().mockRejectedValue(new Error("DB error")),
        })),
      };
      mockDb.insert.mockReturnValue(insertChain);

      const request: NotificationCreationRequest = {
        channelId: "550e8400-e29b-41d4-a716-446655440000",
        title: { en: "Test" },
        description: { en: "Test" },
      };

      await expect(service.createNotification(request)).rejects.toThrow("DB error");
    });
  });

  describe("getNotificationsForStaff", () => {
    let service: NotificationService;

    beforeEach(async () => {
      service = await NotificationService.forTenant("tenant-123");
    });

    it("should return all notifications for staff member", async () => {
      const mockNotifications = [
        mockNotification,
        {
          id: "notification-456",
          staffId: "staff-123",
          title: { en: "Another Notification" },
          description: { en: "Another description" },
          isRead: true,
        },
      ];

      const selectChain = {
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            orderBy: vi.fn().mockResolvedValue(mockNotifications),
          })),
        })),
      };
      mockDb.select.mockReturnValue(selectChain);

      const result = await service.getNotificationsForStaff("staff-123");

      expect(result).toEqual(mockNotifications);
      expect(mockDb.select).toHaveBeenCalled();
    });

    it("should return empty array when no notifications found", async () => {
      const selectChain = {
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            orderBy: vi.fn().mockResolvedValue([]),
          })),
        })),
      };
      mockDb.select.mockReturnValue(selectChain);

      const result = await service.getNotificationsForStaff("staff-123");

      expect(result).toEqual([]);
    });

    it("should handle database error", async () => {
      const selectChain = {
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            orderBy: vi.fn().mockRejectedValue(new Error("DB error")),
          })),
        })),
      };
      mockDb.select.mockReturnValue(selectChain);

      await expect(service.getNotificationsForStaff("staff-123")).rejects.toThrow("DB error");
    });
  });

  describe("hasUnreadNotifications", () => {
    let service: NotificationService;

    beforeEach(async () => {
      service = await NotificationService.forTenant("tenant-123");
    });

    it("should return true when unread notifications exist", async () => {
      const selectChain = {
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue([{ id: "notification-123" }]),
          })),
        })),
      };
      mockDb.select.mockReturnValue(selectChain);

      const result = await service.hasUnreadNotifications("staff-123");

      expect(result).toBe(true);
    });

    it("should return false when no unread notifications exist", async () => {
      const selectChain = {
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue([]),
          })),
        })),
      };
      mockDb.select.mockReturnValue(selectChain);

      const result = await service.hasUnreadNotifications("staff-123");

      expect(result).toBe(false);
    });

    it("should handle database error", async () => {
      const selectChain = {
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn().mockRejectedValue(new Error("DB error")),
          })),
        })),
      };
      mockDb.select.mockReturnValue(selectChain);

      await expect(service.hasUnreadNotifications("staff-123")).rejects.toThrow("DB error");
    });
  });

  describe("deleteNotification", () => {
    let service: NotificationService;

    beforeEach(async () => {
      service = await NotificationService.forTenant("tenant-123");
    });

    it("should delete notification successfully when it belongs to staff member", async () => {
      const deleteChain = {
        where: vi.fn().mockResolvedValue(undefined),
      };
      mockDb.delete.mockReturnValue(deleteChain);

      await service.deleteNotification("notification-123", "staff-123");

      expect(mockDb.delete).toHaveBeenCalled();
    });

    it("should not throw error when notification does not exist or belongs to different staff member", async () => {
      const deleteChain = {
        where: vi.fn().mockResolvedValue(undefined),
      };
      mockDb.delete.mockReturnValue(deleteChain);

      // Should complete without error even if notification doesn't exist
      await service.deleteNotification("notification-123", "staff-456");

      expect(mockDb.delete).toHaveBeenCalled();
    });

    it("should handle database error during deletion", async () => {
      const selectChain = {
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue([mockNotification]),
          })),
        })),
      };
      mockDb.select.mockReturnValue(selectChain);

      const deleteChain = {
        where: vi.fn().mockRejectedValue(new Error("DB error")),
      };
      mockDb.delete.mockReturnValue(deleteChain);

      await expect(service.deleteNotification("notification-123", "staff-123")).rejects.toThrow(
        "DB error",
      );
    });
  });

  describe("markAsRead", () => {
    let service: NotificationService;

    beforeEach(async () => {
      service = await NotificationService.forTenant("tenant-123");
    });

    it("should mark notification as read successfully when it belongs to staff member", async () => {
      const updateChain = {
        set: vi.fn(() => ({
          where: vi.fn().mockResolvedValue(undefined),
        })),
      };
      mockDb.update.mockReturnValue(updateChain);

      await service.markAsRead("notification-123", "staff-123");

      expect(mockDb.update).toHaveBeenCalled();
      expect(updateChain.set).toHaveBeenCalledWith({ isRead: true });
    });

    it("should not throw error when notification does not exist or belongs to different staff member", async () => {
      const updateChain = {
        set: vi.fn(() => ({
          where: vi.fn().mockResolvedValue(undefined),
        })),
      };
      mockDb.update.mockReturnValue(updateChain);

      // Should complete without error even if notification doesn't exist
      await service.markAsRead("notification-123", "staff-456");

      expect(mockDb.update).toHaveBeenCalled();
    });

    it("should handle database error during update", async () => {
      const selectChain = {
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue([mockNotification]),
          })),
        })),
      };
      mockDb.select.mockReturnValue(selectChain);

      const updateChain = {
        set: vi.fn(() => ({
          where: vi.fn().mockRejectedValue(new Error("DB error")),
        })),
      };
      mockDb.update.mockReturnValue(updateChain);

      await expect(service.markAsRead("notification-123", "staff-123")).rejects.toThrow("DB error");
    });
  });

  describe("deleteAllNotifications", () => {
    let service: NotificationService;

    beforeEach(async () => {
      service = await NotificationService.forTenant("tenant-123");
    });

    it("should delete all notifications for staff member", async () => {
      const deleteChain = {
        where: vi.fn(() => ({
          returning: vi.fn().mockResolvedValue([{ id: "1" }, { id: "2" }, { id: "3" }]),
        })),
      };
      mockDb.delete.mockReturnValue(deleteChain);

      const result = await service.deleteAllNotifications("staff-123", false);

      expect(result).toBe(3);
      expect(mockDb.delete).toHaveBeenCalled();
    });

    it("should delete only read notifications when readOnly is true", async () => {
      const deleteChain = {
        where: vi.fn(() => ({
          returning: vi.fn().mockResolvedValue([{ id: "1" }, { id: "2" }]),
        })),
      };
      mockDb.delete.mockReturnValue(deleteChain);

      const result = await service.deleteAllNotifications("staff-123", true);

      expect(result).toBe(2);
      expect(mockDb.delete).toHaveBeenCalled();
    });

    it("should return 0 when no notifications deleted", async () => {
      const deleteChain = {
        where: vi.fn(() => ({
          returning: vi.fn().mockResolvedValue([]),
        })),
      };
      mockDb.delete.mockReturnValue(deleteChain);

      const result = await service.deleteAllNotifications("staff-123", false);

      expect(result).toBe(0);
    });

    it("should handle database error during deletion", async () => {
      const deleteChain = {
        where: vi.fn(() => ({
          returning: vi.fn().mockRejectedValue(new Error("DB error")),
        })),
      };
      mockDb.delete.mockReturnValue(deleteChain);

      await expect(service.deleteAllNotifications("staff-123", false)).rejects.toThrow("DB error");
    });
  });
});
