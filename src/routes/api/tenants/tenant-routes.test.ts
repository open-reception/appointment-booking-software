/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies before importing the actual modules
vi.mock("$lib/server/services/tenant-admin-service", () => ({
  TenantAdminService: {
    getTenantById: vi.fn(),
    createTenant: vi.fn(),
    getConfigDefaults: vi.fn(),
  },
}));

vi.mock("$lib/server/openapi", () => ({
  registerOpenAPIRoute: vi.fn(),
}));

vi.mock("@sveltejs/kit", () => ({
  json: vi.fn((data, options) => ({
    json: () => Promise.resolve(data),
    data,
    status: options?.status || 200,
  })),
}));

vi.mock("$lib/logger", () => ({
  default: {
    setContext: vi.fn(() => ({
      debug: vi.fn(),
      error: vi.fn(),
    })),
  },
}));

vi.mock("$lib/server/utils/errors", () => ({
  ValidationError: class ValidationError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "ValidationError";
    }
  },
  NotFoundError: class NotFoundError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "NotFoundError";
    }
  },
}));

describe("Tenant API Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("PUT /api/tenants/123", () => {
    it("should update tenant metadata successfully", async () => {
      // Dynamic import to avoid module loading issues
      const { PUT } = await import("./[id]/+server.js");
      const { TenantAdminService } = await import("$lib/server/services/tenant-admin-service");

      const mockTenantService = {
        updateTenantData: vi.fn().mockResolvedValue({
          id: "123",
          shortName: "updated-tenant",
          longName: "Updated Tenant Corp",
          description: "Updated description",
          updatedAt: new Date(),
        }),
      };

      vi.mocked(TenantAdminService.getTenantById).mockResolvedValue(mockTenantService as any);

      const mockRequest = {
        json: () =>
          Promise.resolve({
            longName: "Updated Tenant Corp",
            description: "Updated description",
          }),
      };

      const response = await PUT({
        params: { id: "123" },
        request: mockRequest as any,
      } as any);
      const data = await response.json();

      expect(TenantAdminService.getTenantById).toHaveBeenCalledWith("123");
      expect(mockTenantService.updateTenantData).toHaveBeenCalledWith({
        longName: "Updated Tenant Corp",
        description: "Updated description",
      });

      expect(data.message).toBe("Tenant metadata updated successfully");
      expect(data.tenant.longName).toBe("Updated Tenant Corp");
    });

    it("should handle missing tenant ID", async () => {
      const { PUT } = await import("./[id]/+server.js");

      const mockRequest = {
        json: () =>
          Promise.resolve({
            longName: "Updated Name",
          }),
      };

      const response = await PUT({
        params: { id: "" },
        request: mockRequest as any,
      } as any);
      const data = await response.json();

      expect(data).toEqual({
        error: "No tenant id given",
      });
      expect(response.status).toBe(400);
    });
  });

  describe("GET /api/tenants/123/config", () => {
    it("should get tenant configuration successfully", async () => {
      const { GET } = await import("./[id]/config/+server.js");
      const { TenantAdminService } = await import("$lib/server/services/tenant-admin-service");

      const mockConfig = {
        brandColor: "#E11E15",
        defaultLanguage: "DE",
        maxChannels: 5,
        requireEmail: true,
      };

      const mockTenantService = {
        configuration: mockConfig,
      };

      vi.mocked(TenantAdminService.getTenantById).mockResolvedValue(mockTenantService as any);

      const response = await GET({ params: { id: "123" } } as any);
      const data = await response.json();

      expect(TenantAdminService.getTenantById).toHaveBeenCalledWith("123");
      expect(data).toEqual(mockConfig);
    });

    it("should handle missing tenant ID in GET", async () => {
      const { GET } = await import("./[id]/config/+server.js");

      const response = await GET({ params: { id: "" } } as any);
      const data = await response.json();

      expect(data).toEqual({
        error: "No tenant id given",
      });
      expect(response.status).toBe(400);
    });
  });

  describe("PUT /api/tenants/123/config", () => {
    it("should update tenant configuration successfully", async () => {
      const { PUT } = await import("./[id]/config/+server.js");
      const { TenantAdminService } = await import("$lib/server/services/tenant-admin-service");

      const mockTenantService = {
        updateTenantConfig: vi.fn().mockResolvedValue([
          { key: "brandColor", value: "#FF0000" },
          { key: "maxChannels", value: 10 },
        ]),
      };

      vi.mocked(TenantAdminService.getTenantById).mockResolvedValue(mockTenantService as any);

      const mockRequest = {
        json: () =>
          Promise.resolve({
            brandColor: "#FF0000",
            maxChannels: 10,
          }),
      };

      const response = await PUT({
        params: { id: "123" },
        request: mockRequest as any,
      } as any);
      const data = await response.json();

      expect(TenantAdminService.getTenantById).toHaveBeenCalledWith("123");
      expect(mockTenantService.updateTenantConfig).toHaveBeenCalledWith({
        brandColor: "#FF0000",
        maxChannels: 10,
      });

      expect(data.message).toBe("Configuration updated successfully");
      expect(data.updatedKeys).toEqual(["brandColor", "maxChannels"]);
    });

    it("should handle validation errors", async () => {
      const { PUT } = await import("./[id]/config/+server.js");
      const { TenantAdminService } = await import("$lib/server/services/tenant-admin-service");
      const { ValidationError } = await import("$lib/server/utils/errors");

      const mockTenantService = {
        updateTenantConfig: vi
          .fn()
          .mockRejectedValue(new ValidationError("Invalid configuration data")),
      };

      vi.mocked(TenantAdminService.getTenantById).mockResolvedValue(mockTenantService as any);

      const mockRequest = {
        json: () =>
          Promise.resolve({
            maxChannels: "invalid", // Should be number
          }),
      };

      const response = await PUT({
        params: { id: "123" },
        request: mockRequest as any,
      } as any);
      const data = await response.json();

      expect(data).toEqual({
        error: "Invalid configuration data",
      });
      expect(response.status).toBe(400);
    });

    it("should handle tenant not found", async () => {
      const { PUT } = await import("./[id]/config/+server.js");
      const { TenantAdminService } = await import("$lib/server/services/tenant-admin-service");
      const { NotFoundError } = await import("$lib/server/utils/errors");

      vi.mocked(TenantAdminService.getTenantById).mockRejectedValue(
        new NotFoundError("Tenant not found"),
      );

      const mockRequest = {
        json: () =>
          Promise.resolve({
            brandColor: "#FF0000",
          }),
      };

      const response = await PUT({
        params: { id: "non-existent-id" },
        request: mockRequest as any,
      } as any);
      const data = await response.json();

      expect(data).toEqual({
        error: "Tenant not found",
      });
      expect(response.status).toBe(404);
    });
  });
});
