/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { StaffService } from "../staff-service";
import { NotFoundError, ValidationError, InternalError } from "../../utils/errors";

// Mock dependencies
vi.mock("../../db", () => ({
  centralDb: {
    select: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    transaction: vi.fn(),
  },
  getTenantDb: vi.fn(),
}));

vi.mock("../staff-crypto.service", () => ({
  StaffCryptoService: vi.fn().mockImplementation(() => ({
    getStaffPublicKey: vi.fn(),
  })),
}));

vi.mock("../tenant-admin-service", () => ({
  TenantAdminService: {
    getTenantById: vi.fn(),
  },
}));

vi.mock("../user-service", () => ({
  UserService: {
    deleteUser: vi.fn(),
  },
}));

const mockStaffMember = {
  id: "staff-123",
  email: "staff@example.com",
  name: "Staff Member",
  role: "STAFF" as const,
  isActive: true,
  confirmationState: "ACCESS_GRANTED" as const,
  createdAt: new Date(),
  updatedAt: new Date(),
  lastLoginAt: new Date(),
};

describe("StaffService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetAllMocks();
  });

  describe("getStaffMembers", () => {
    it("should return staff members for a tenant", async () => {
      const { centralDb } = await import("../../db");

      // Mock the first select query (for users)
      const mockSelectBuilder1 = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([mockStaffMember]),
      };

      // Mock the second select query (for invites)
      const mockSelectBuilder2 = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      };

      // Mock centralDb.select to return different builders for each call
      vi.mocked(centralDb.select)
        .mockReturnValueOnce(mockSelectBuilder1 as any)
        .mockReturnValueOnce(mockSelectBuilder2 as any);

      const result = await StaffService.getStaffMembers("tenant-123");

      expect(centralDb.select).toHaveBeenCalledTimes(2);
      expect(mockSelectBuilder1.from).toHaveBeenCalled();
      expect(mockSelectBuilder1.where).toHaveBeenCalled();
      expect(mockSelectBuilder2.from).toHaveBeenCalled();
      expect(mockSelectBuilder2.where).toHaveBeenCalled();
      expect(result).toEqual([mockStaffMember]);
    });

    it("should handle database errors", async () => {
      const { centralDb } = await import("../../db");

      const mockSelectBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockRejectedValue(new Error("Database error")),
      };

      vi.mocked(centralDb.select).mockReturnValue(mockSelectBuilder as any);

      await expect(StaffService.getStaffMembers("tenant-123")).rejects.toThrow(InternalError);
    });
  });

  describe("updateStaffMember", () => {
    it("should update a staff member successfully", async () => {
      const { centralDb } = await import("../../db");

      const mockUpdateBuilder = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([mockStaffMember]),
      };

      vi.mocked(centralDb.update).mockReturnValue(mockUpdateBuilder as any);

      const updateData = { name: "Updated Name" };
      const result = await StaffService.updateStaffMember("tenant-123", "staff-123", updateData);

      expect(centralDb.update).toHaveBeenCalled();
      expect(mockUpdateBuilder.set).toHaveBeenCalledWith({
        ...updateData,
        updatedAt: expect.any(Date),
      });
      expect(mockUpdateBuilder.where).toHaveBeenCalled();
      expect(mockUpdateBuilder.returning).toHaveBeenCalled();
      expect(result).toEqual(mockStaffMember);
    });

    it("should prevent self-deactivation", async () => {
      const updateData = { isActive: false };

      await expect(
        StaffService.updateStaffMember("tenant-123", "staff-123", updateData, "staff-123"),
      ).rejects.toThrow(ValidationError);
    });

    it("should throw NotFoundError when staff member not found", async () => {
      const { centralDb } = await import("../../db");

      const mockUpdateBuilder = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([]),
      };

      vi.mocked(centralDb.update).mockReturnValue(mockUpdateBuilder as any);

      const updateData = { name: "Updated Name" };

      await expect(
        StaffService.updateStaffMember("tenant-123", "staff-123", updateData),
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe("deleteStaffMember", () => {
    it("should propagate validation errors from UserService", async () => {
      const { centralDb } = await import("../../db");
      const { UserService } = await import("../user-service");

      vi.mocked(UserService.deleteUser).mockRejectedValue(
        new ValidationError("Cannot delete the last STAFF user for this tenant"),
      );

      const mockTransaction = vi.fn().mockImplementation(async (callback) => {
        const tx = {
          select: vi.fn().mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([
                  {
                    id: "staff-123",
                    email: "staff@example.com",
                    name: "Staff Member",
                    role: "STAFF",
                    tenantId: "tenant-123",
                  },
                ]),
              }),
            }),
          }),
          delete: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue({ count: 1 }),
          }),
        };
        return await callback(tx);
      });

      vi.mocked(centralDb.transaction).mockImplementation(mockTransaction);

      await expect(StaffService.deleteStaffMember("tenant-123", "staff-123")).rejects.toThrow(
        ValidationError,
      );
    });

    it("should delete a staff member successfully when multiple exist", async () => {
      const { centralDb, getTenantDb } = await import("../../db");
      const { UserService } = await import("../user-service");

      // Mock UserService.deleteUser - wichtig: das muss vor der transaction() mock sein
      const mockUserDeletionResult = {
        success: true,
        deletedUser: {
          id: "staff-123",
          email: "staff@example.com",
          name: "Staff Member",
          role: "STAFF" as const,
        },
        deletedPasskeysCount: 2,
        tenantId: "tenant-123",
      };
      vi.mocked(UserService.deleteUser).mockResolvedValue(mockUserDeletionResult);

      // Mock tenant database for key shares
      const mockTenantDb = {
        delete: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue({ count: 1 }),
        }),
      };
      vi.mocked(getTenantDb).mockResolvedValue(mockTenantDb as any);

      // Mock transaction
      const mockTransaction = vi.fn().mockImplementation(async (callback) => {
        const tx = {
          select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([
                  {
                    id: "staff-123",
                    email: "staff@example.com",
                    name: "Staff Member",
                    role: "STAFF",
                    tenantId: "tenant-123",
                  },
                ]),
              }),
            }),
          }),
          delete: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue({ count: 1 }),
          }),
        };
        return await callback(tx);
      });

      vi.mocked(centralDb.transaction).mockImplementation(mockTransaction);

      const result = await StaffService.deleteStaffMember("tenant-123", "staff-123");

      expect(result.success).toBe(true);
      expect(result.deletedUser.id).toBe("staff-123");
      expect(result.deletedPasskeysCount).toBe(2);
      expect(result.deletedKeySharesCount).toBe(1);
    });

    it("should prevent self-deletion", async () => {
      await expect(
        StaffService.deleteStaffMember("tenant-123", "staff-123", "staff-123"),
      ).rejects.toThrow(ValidationError);
    });

    it("should throw NotFoundError when staff member not found", async () => {
      const { centralDb } = await import("../../db");

      const mockTransaction = vi.fn().mockImplementation(async (callback) => {
        const tx = {
          select: vi
            .fn()
            .mockReturnValueOnce({
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue([]), // No user found
                }),
              }),
            })
            .mockReturnValueOnce({
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue([]), // No invite found
                }),
              }),
            }),
        };
        return await callback(tx);
      });

      vi.mocked(centralDb.transaction).mockImplementation(mockTransaction);

      await expect(StaffService.deleteStaffMember("tenant-123", "staff-123")).rejects.toThrow(
        NotFoundError,
      );
    });

    it("should delete invited staff member when no user exists", async () => {
      const { centralDb } = await import("../../db");

      const mockTransaction = vi.fn().mockImplementation(async (callback) => {
        const tx = {
          select: vi
            .fn()
            .mockReturnValueOnce({
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue([]), // No user found
                }),
              }),
            })
            .mockReturnValueOnce({
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue([{ id: "staff-123" }]), // Invite found
                }),
              }),
            }),
          delete: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue({ count: 1 }),
          }),
        };
        return await callback(tx);
      });

      vi.mocked(centralDb.transaction).mockImplementation(mockTransaction);

      const result = await StaffService.deleteStaffMember("tenant-123", "staff-123");

      expect(result.success).toBe(true);
      expect(result.deletedUser.id).toBe("staff-123");
      expect(result.deletedPasskeysCount).toBe(0);
      expect(result.deletedKeySharesCount).toBe(0);
    });
  });

  describe("getStaffPublicKey", () => {
    it("should return staff public key", async () => {
      const { centralDb } = await import("../../db");
      const { StaffCryptoService } = await import("../staff-crypto.service");

      const mockSelectBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([
          {
            id: "staff-123",
            tenantId: "tenant-123",
            isActive: true,
          },
        ]),
      };

      vi.mocked(centralDb.select).mockReturnValue(mockSelectBuilder as any);

      const mockStaffCryptoService = {
        getStaffPublicKey: vi.fn().mockResolvedValue("mock-public-key"),
      };
      vi.mocked(StaffCryptoService).mockImplementation(() => mockStaffCryptoService as any);

      const result = await StaffService.getStaffPublicKey("tenant-123", "staff-123");

      expect(result.userId).toBe("staff-123");
      expect(result.publicKey).toBe("mock-public-key");
    });

    it("should throw ValidationError for inactive staff", async () => {
      const { centralDb } = await import("../../db");

      const mockSelectBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([
          {
            id: "staff-123",
            tenantId: "tenant-123",
            isActive: false,
          },
        ]),
      };

      vi.mocked(centralDb.select).mockReturnValue(mockSelectBuilder as any);

      await expect(StaffService.getStaffPublicKey("tenant-123", "staff-123")).rejects.toThrow(
        ValidationError,
      );
    });

    it("should throw ValidationError for staff from different tenant", async () => {
      const { centralDb } = await import("../../db");

      const mockSelectBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([
          {
            id: "staff-123",
            tenantId: "different-tenant",
            isActive: true,
          },
        ]),
      };

      vi.mocked(centralDb.select).mockReturnValue(mockSelectBuilder as any);

      await expect(StaffService.getStaffPublicKey("tenant-123", "staff-123")).rejects.toThrow(
        ValidationError,
      );
    });
  });

  describe("validateStaffMember", () => {
    it("should validate staff member successfully", async () => {
      const { centralDb } = await import("../../db");

      const mockSelectBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([mockStaffMember]),
      };

      vi.mocked(centralDb.select).mockReturnValue(mockSelectBuilder as any);

      const result = await StaffService.validateStaffMember("tenant-123", "staff-123");

      expect(result).toEqual(mockStaffMember);
    });

    it("should throw NotFoundError when staff member not found", async () => {
      const { centralDb } = await import("../../db");

      const mockSelectBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };

      vi.mocked(centralDb.select).mockReturnValue(mockSelectBuilder as any);

      await expect(StaffService.validateStaffMember("tenant-123", "staff-123")).rejects.toThrow(
        NotFoundError,
      );
    });
  });
});
