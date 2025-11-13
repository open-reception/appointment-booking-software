/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AppointmentService } from "../appointment-service";
import { NotFoundError, ConflictError } from "../../utils/errors";

// Mock dependencies
vi.mock("../../db", () => ({
  getTenantDb: vi.fn(),
  centralDb: {
    select: vi.fn(),
  },
}));

const mockAppointment = {
  id: "appointment-123",
  tunnelId: "tunnel-123",
  channelId: "channel-123",
  appointmentDate: new Date("2024-01-15T10:00:00Z"),
  status: "NEW" as const,
  encryptedPayload: "encrypted-data",
  iv: "iv-data",
  authTag: "auth-tag",
  createdAt: new Date(),
  updatedAt: new Date(),
  expiryDate: null,
};

const mockClientTunnel = {
  id: "tunnel-123",
  emailHash: "email-hash-123",
  clientPublicKey: "client-public-key",
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockClientTunnelData = {
  tunnelId: "tunnel-123",
  channelId: "channel-123",
  agentId: "agent-123",
  appointmentDate: "2024-01-15T10:00:00Z",
  emailHash: "email-hash-123",
  clientPublicKey: "client-public-key",
  privateKeyShare: "private-key-share",
  encryptedAppointment: {
    encryptedPayload: "encrypted-data",
    iv: "iv-data",
    authTag: "auth-tag",
  },
  staffKeyShares: [
    {
      userId: "staff-123",
      encryptedTunnelKey: "encrypted-tunnel-key",
    },
  ],
  clientEncryptedTunnelKey: "client-encrypted-tunnel-key",
};

describe("AppointmentService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("forTenant", () => {
    it("should create service for valid tenant", async () => {
      const { getTenantDb } = await import("../../db");
      const mockDb = { select: vi.fn() };
      vi.mocked(getTenantDb).mockResolvedValue(mockDb as any);

      const service = await AppointmentService.forTenant("tenant-123");

      expect(service.tenantId).toBe("tenant-123");
      expect(getTenantDb).toHaveBeenCalledWith("tenant-123");
    });

    it("should handle database connection errors", async () => {
      const { getTenantDb } = await import("../../db");
      vi.mocked(getTenantDb).mockRejectedValue(new Error("Database connection failed"));

      await expect(AppointmentService.forTenant("tenant-123")).rejects.toThrow();
    });
  });

  describe("getClientTunnels", () => {
    it("should return client tunnels", async () => {
      const { getTenantDb } = await import("../../db");
      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([mockClientTunnel]),
          }),
        }),
      };
      vi.mocked(getTenantDb).mockResolvedValue(mockDb as any);

      const service = await AppointmentService.forTenant("tenant-123");
      const result = await service.getClientTunnels();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("tunnel-123");
      expect(result[0].emailHash).toBe("email-hash-123");
      expect(result[0].clientPublicKey).toBe("client-public-key");
      expect(result[0].createdAt).toBeDefined();
    });

    it("should return empty array when no tunnels exist", async () => {
      const { getTenantDb } = await import("../../db");
      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([]),
          }),
        }),
      };
      vi.mocked(getTenantDb).mockResolvedValue(mockDb as any);

      const service = await AppointmentService.forTenant("tenant-123");
      const result = await service.getClientTunnels();

      expect(result).toEqual([]);
    });
  });

  describe("createNewClientWithAppointment", () => {
    it("should create client tunnel and appointment successfully", async () => {
      const { getTenantDb, centralDb } = await import("../../db");

      // Mock authorization check - users exist
      const mockAuthBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ count: "1" }]),
      };
      vi.mocked(centralDb.select).mockReturnValue(mockAuthBuilder as any);

      // Mock existing tunnel check (client doesn't exist yet)
      const mockExistingTunnelBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]), // No existing tunnel
      };

      // Mock tenant database transaction
      const mockTransaction = vi.fn().mockImplementation(async (callback) => {
        const tx = {
          insert: vi
            .fn()
            .mockReturnValueOnce({
              values: vi.fn().mockReturnValue({
                returning: vi.fn().mockResolvedValue([{ id: "tunnel-123" }]),
              }),
            })
            .mockReturnValueOnce({
              values: vi.fn().mockResolvedValue(undefined),
            })
            .mockReturnValueOnce({
              values: vi.fn().mockReturnValue({
                returning: vi.fn().mockResolvedValue([
                  {
                    id: "appointment-123",
                    appointmentDate: new Date("2024-01-15T10:00:00Z"),
                    status: "NEW",
                  },
                ]),
              }),
            }),
          select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([{ requiresConfirmation: true }]),
              }),
            }),
          }),
        };
        return await callback(tx);
      });

      const mockDb = {
        select: vi.fn().mockReturnValue(mockExistingTunnelBuilder as any),
        transaction: mockTransaction,
      };
      vi.mocked(getTenantDb).mockResolvedValue(mockDb as any);

      const service = await AppointmentService.forTenant("tenant-123");
      const result = await service.createNewClientWithAppointment(mockClientTunnelData);

      expect(result.id).toBe("appointment-123");
      expect(result.status).toBe("NEW");
      expect(result.appointmentDate).toBe("2024-01-15T10:00:00.000Z");
    });

    it("should block creation when no authorized users exist", async () => {
      const { centralDb } = await import("../../db");

      // Mock authorization check - no users exist
      const mockAuthBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };
      vi.mocked(centralDb.select).mockReturnValue(mockAuthBuilder as any);

      const service = await AppointmentService.forTenant("tenant-123");

      await expect(service.createNewClientWithAppointment(mockClientTunnelData)).rejects.toThrow(
        ConflictError,
      );
    });

    it("should throw ConflictError when client already exists", async () => {
      const { getTenantDb, centralDb } = await import("../../db");

      // Mock authorization check - users exist
      const mockAuthBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ count: "1" }]),
      };
      vi.mocked(centralDb.select).mockReturnValue(mockAuthBuilder as any);

      // Mock existing tunnel check (client already exists)
      const mockExistingTunnelBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ id: "existing-tunnel-123" }]), // Existing tunnel found
      };

      const mockDb = {
        select: vi.fn().mockReturnValue(mockExistingTunnelBuilder as any),
      };
      vi.mocked(getTenantDb).mockResolvedValue(mockDb as any);

      const service = await AppointmentService.forTenant("tenant-123");

      await expect(service.createNewClientWithAppointment(mockClientTunnelData)).rejects.toThrow(
        ConflictError,
      );
      await expect(service.createNewClientWithAppointment(mockClientTunnelData)).rejects.toThrow(
        "This email address is already registered",
      );
    });

    it("should throw NotFoundError when channel not found", async () => {
      const { getTenantDb, centralDb } = await import("../../db");

      // Mock authorization check - users exist
      const mockAuthBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ count: "1" }]),
      };
      vi.mocked(centralDb.select).mockReturnValue(mockAuthBuilder as any);

      // Mock existing tunnel check (client doesn't exist yet)
      const mockExistingTunnelBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]), // No existing tunnel
      };

      // Mock tenant database transaction with channel not found
      const mockTransaction = vi.fn().mockImplementation(async (callback) => {
        const tx = {
          insert: vi
            .fn()
            .mockReturnValueOnce({
              values: vi.fn().mockReturnValue({
                returning: vi.fn().mockResolvedValue([{ id: "tunnel-123" }]),
              }),
            })
            .mockReturnValueOnce({
              values: vi.fn().mockResolvedValue(undefined),
            }),
          select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([]), // Channel not found
              }),
            }),
          }),
        };
        return await callback(tx);
      });

      const mockDb = {
        select: vi.fn().mockReturnValue(mockExistingTunnelBuilder as any),
        transaction: mockTransaction,
      };
      vi.mocked(getTenantDb).mockResolvedValue(mockDb as any);

      const service = await AppointmentService.forTenant("tenant-123");

      await expect(service.createNewClientWithAppointment(mockClientTunnelData)).rejects.toThrow(
        NotFoundError,
      );
    });

    it("should create appointment with CONFIRMED status when staff user creates it", async () => {
      const { getTenantDb, centralDb } = await import("../../db");

      // Mock authorization check - users exist
      const mockAuthBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ count: "1" }]),
      };
      vi.mocked(centralDb.select).mockReturnValue(mockAuthBuilder as any);

      // Mock existing tunnel check (client doesn't exist yet)
      const mockExistingTunnelBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]), // No existing tunnel
      };

      // Mock tenant database transaction with successful creation
      const mockTransaction = vi.fn().mockImplementation(async (callback) => {
        const tx = {
          insert: vi
            .fn()
            .mockReturnValueOnce({
              values: vi.fn().mockReturnValue({
                returning: vi.fn().mockResolvedValue([{ id: "tunnel-123" }]),
              }),
            })
            .mockReturnValueOnce({
              values: vi.fn().mockResolvedValue(undefined),
            })
            .mockReturnValueOnce({
              values: vi.fn().mockReturnValue({
                returning: vi.fn().mockResolvedValue([
                  {
                    id: "apt-123",
                    appointmentDate: new Date("2024-01-01T10:00:00Z"),
                    status: "CONFIRMED",
                  },
                ]),
              }),
            }),
          select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([{ id: "channel-456" }]), // Channel found
              }),
            }),
          }),
        };
        return await callback(tx);
      });

      const mockDb = {
        select: vi.fn().mockReturnValue(mockExistingTunnelBuilder as any),
        transaction: mockTransaction,
      };
      vi.mocked(getTenantDb).mockResolvedValue(mockDb as any);

      const service = await AppointmentService.forTenant("tenant-123");
      const result = await service.createNewClientWithAppointment(mockClientTunnelData);

      expect(result.status).toBe("CONFIRMED");
      expect(mockTransaction).toHaveBeenCalled();
    });
  });

  describe("getAppointmentsByTimeRange", () => {
    it("should return appointments within time range", async () => {
      const { getTenantDb } = await import("../../db");
      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue([mockAppointment]),
            }),
          }),
        }),
      };
      vi.mocked(getTenantDb).mockResolvedValue(mockDb as any);

      const service = await AppointmentService.forTenant("tenant-123");
      const startDate = new Date("2024-01-01T00:00:00Z");
      const endDate = new Date("2024-01-31T23:59:59Z");

      const result = await service.getAppointmentsByTimeRange(startDate, endDate);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("appointment-123");
    });

    it("should return empty array when no appointments in range", async () => {
      const { getTenantDb } = await import("../../db");
      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      };
      vi.mocked(getTenantDb).mockResolvedValue(mockDb as any);

      const service = await AppointmentService.forTenant("tenant-123");
      const startDate = new Date("2024-01-01T00:00:00Z");
      const endDate = new Date("2024-01-31T23:59:59Z");

      const result = await service.getAppointmentsByTimeRange(startDate, endDate);

      expect(result).toEqual([]);
    });
  });

  describe("deleteAppointment", () => {
    it("should delete appointment successfully", async () => {
      const { getTenantDb } = await import("../../db");
      const mockDb = {
        delete: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([mockAppointment]),
          }),
        }),
      };
      vi.mocked(getTenantDb).mockResolvedValue(mockDb as any);

      const service = await AppointmentService.forTenant("tenant-123");
      const result = await service.deleteAppointment("appointment-123");

      expect(result).toBe(true);
    });

    it("should return false when appointment not found", async () => {
      const { getTenantDb } = await import("../../db");
      const mockDb = {
        delete: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      };
      vi.mocked(getTenantDb).mockResolvedValue(mockDb as any);

      const service = await AppointmentService.forTenant("tenant-123");
      const result = await service.deleteAppointment("appointment-123");

      expect(result).toBe(false);
    });
  });
});
