/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./+server.js";
import { GET } from "./config/defaults/+server.js";

// Mock the TenantAdminService
vi.mock("$lib/server/services/tenant-admin-service", () => ({
	TenantAdminService: {
		createTenant: vi.fn(),
		getConfigDefaults: vi.fn()
	}
}));

// Mock the OpenAPI registration
vi.mock("$lib/server/openapi", () => ({
	registerOpenAPIRoute: vi.fn()
}));

// Mock SvelteKit json helper
vi.mock("@sveltejs/kit", () => ({
	json: vi.fn((data, options) => ({
		json: () => Promise.resolve(data),
		data,
		status: options?.status || 200
	}))
}));

// Mock logger
vi.mock("$lib/logger", () => ({
	default: {
		setContext: vi.fn(() => ({
			debug: vi.fn(),
			error: vi.fn()
		}))
	}
}));

// Mock ValidationError
vi.mock("$lib/server/utils/errors", () => ({
	ValidationError: class ValidationError extends Error {
		constructor(message: string) {
			super(message);
			this.name = "ValidationError";
		}
	}
}));

describe("/api/tenants", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("POST /api/tenants", () => {
		it("should create a tenant successfully", async () => {
			const { TenantAdminService } = await import("$lib/server/services/tenant-admin-service");
			
			const mockTenantService = {
				tenantId: "test-tenant-id"
			};
			
			vi.mocked(TenantAdminService.createTenant).mockResolvedValue(mockTenantService as any);

			const mockRequest = {
				json: () => Promise.resolve({
					shortName: "test-tenant",
					inviteAdmin: "admin@test.com"
				})
			};

			const response = await POST({ request: mockRequest as any });
			const data = await response.json();

			expect(TenantAdminService.createTenant).toHaveBeenCalledWith({
				shortName: "test-tenant",
				inviteAdmin: "admin@test.com"
			});

			expect(data).toEqual({
				message: "Tenant created successfully",
				tenantId: "test-tenant-id",
				shortName: "test-tenant"
			});
			expect(response.status).toBe(201);
		});

		it("should create a tenant without invite admin", async () => {
			const { TenantAdminService } = await import("$lib/server/services/tenant-admin-service");
			
			const mockTenantService = {
				tenantId: "test-tenant-id-2"
			};
			
			vi.mocked(TenantAdminService.createTenant).mockResolvedValue(mockTenantService as any);

			const mockRequest = {
				json: () => Promise.resolve({
					shortName: "test-tenant-2"
				})
			};

			const response = await POST({ request: mockRequest as any });
			const data = await response.json();

			expect(TenantAdminService.createTenant).toHaveBeenCalledWith({
				shortName: "test-tenant-2"
			});

			expect(data).toEqual({
				message: "Tenant created successfully",
				tenantId: "test-tenant-id-2",
				shortName: "test-tenant-2"
			});
			expect(response.status).toBe(201);
		});

		it("should handle validation errors", async () => {
			const { TenantAdminService } = await import("$lib/server/services/tenant-admin-service");
			const { ValidationError } = await import("$lib/server/utils/errors");
			
			vi.mocked(TenantAdminService.createTenant).mockRejectedValue(
				new ValidationError("Invalid tenant creation request")
			);

			const mockRequest = {
				json: () => Promise.resolve({
					shortName: "ab" // Too short
				})
			};

			const response = await POST({ request: mockRequest as any });
			const data = await response.json();

			expect(data).toEqual({
				error: "Invalid tenant creation request"
			});
			expect(response.status).toBe(400);
		});

		it("should handle unique constraint violations", async () => {
			const { TenantAdminService } = await import("$lib/server/services/tenant-admin-service");
			
			vi.mocked(TenantAdminService.createTenant).mockRejectedValue(
				new Error("unique constraint violation")
			);

			const mockRequest = {
				json: () => Promise.resolve({
					shortName: "existing-tenant"
				})
			};

			const response = await POST({ request: mockRequest as any });
			const data = await response.json();

			expect(data).toEqual({
				error: "A tenant with this short name already exists"
			});
			expect(response.status).toBe(409);
		});

		it("should handle internal server errors", async () => {
			const { TenantAdminService } = await import("$lib/server/services/tenant-admin-service");
			
			vi.mocked(TenantAdminService.createTenant).mockRejectedValue(
				new Error("Database connection failed")
			);

			const mockRequest = {
				json: () => Promise.resolve({
					shortName: "test-tenant"
				})
			};

			const response = await POST({ request: mockRequest as any });
			const data = await response.json();

			expect(data).toEqual({
				error: "Internal server error"
			});
			expect(response.status).toBe(500);
		});
	});

	describe("GET /api/tenants/config/defaults", () => {
		it("should return default configuration", async () => {
			const { TenantAdminService } = await import("$lib/server/services/tenant-admin-service");
			
			const mockDefaults = {
				brandColor: "#E11E15",
				defaultLanguage: "DE",
				maxChannels: -1,
				maxTeamMembers: -1,
				autoDeleteDays: 30,
				requireEmail: true,
				requirePhone: false
			};
			
			vi.mocked(TenantAdminService.getConfigDefaults).mockReturnValue(mockDefaults);

			const response = await GET();
			const data = await response.json();

			expect(TenantAdminService.getConfigDefaults).toHaveBeenCalled();
			expect(data).toEqual(mockDefaults);
			expect(response.status).toBe(200);
		});

		it("should handle errors when getting defaults", async () => {
			const { TenantAdminService } = await import("$lib/server/services/tenant-admin-service");
			
			vi.mocked(TenantAdminService.getConfigDefaults).mockImplementation(() => {
				throw new Error("Configuration error");
			});

			const response = await GET();
			const data = await response.json();

			expect(data).toEqual({
				error: "Internal server error"
			});
			expect(response.status).toBe(500);
		});
	});
});