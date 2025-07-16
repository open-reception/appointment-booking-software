/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from "vitest";
import { AuthorizationService } from "../authorization-service";
import { AuthenticationError } from "$lib/server/utils/errors";
import type { JWTPayload } from "jose";

const mockGlobalAdmin: JWTPayload = {
	userId: "global-admin-id",
	email: "global@example.com",
	name: "Global Admin",
	role: "GLOBAL_ADMIN",
	sessionId: "session-1",
	iat: Date.now(),
	exp: Date.now() + 3600
};

const mockTenantAdmin: JWTPayload = {
	userId: "tenant-admin-id",
	email: "tenant@example.com",
	name: "Tenant Admin",
	role: "TENANT_ADMIN",
	tenantId: "tenant-123",
	sessionId: "session-2",
	iat: Date.now(),
	exp: Date.now() + 3600
};

const mockStaff: JWTPayload = {
	userId: "staff-id",
	email: "staff@example.com",
	name: "Staff Member",
	role: "STAFF",
	tenantId: "tenant-123",
	sessionId: "session-3",
	iat: Date.now(),
	exp: Date.now() + 3600
};

describe("AuthorizationService", () => {
	describe("requireRole", () => {
		it("should allow access for correct role", () => {
			expect(() => {
				AuthorizationService.requireRole(mockGlobalAdmin, "GLOBAL_ADMIN");
			}).not.toThrow();
		});

		it("should deny access for incorrect role", () => {
			expect(() => {
				AuthorizationService.requireRole(mockTenantAdmin, "GLOBAL_ADMIN");
			}).toThrow(AuthenticationError);
		});

		it("should deny access for null user", () => {
			expect(() => {
				AuthorizationService.requireRole(null as any, "GLOBAL_ADMIN");
			}).toThrow(AuthenticationError);
		});
	});

	describe("requireAnyRole", () => {
		it("should allow access for any allowed role", () => {
			expect(() => {
				AuthorizationService.requireAnyRole(mockTenantAdmin, ["GLOBAL_ADMIN", "TENANT_ADMIN"]);
			}).not.toThrow();

			expect(() => {
				AuthorizationService.requireAnyRole(mockStaff, ["TENANT_ADMIN", "STAFF"]);
			}).not.toThrow();
		});

		it("should deny access for disallowed role", () => {
			expect(() => {
				AuthorizationService.requireAnyRole(mockStaff, ["GLOBAL_ADMIN", "TENANT_ADMIN"]);
			}).toThrow(AuthenticationError);
		});
	});

	describe("requireTenantAccess", () => {
		it("should allow global admin access to any tenant", () => {
			expect(() => {
				AuthorizationService.requireTenantAccess(mockGlobalAdmin, "any-tenant-id");
			}).not.toThrow();
		});

		it("should allow tenant admin access to their own tenant", () => {
			expect(() => {
				AuthorizationService.requireTenantAccess(mockTenantAdmin, "tenant-123");
			}).not.toThrow();
		});

		it("should deny tenant admin access to other tenants", () => {
			expect(() => {
				AuthorizationService.requireTenantAccess(mockTenantAdmin, "tenant-456");
			}).toThrow(AuthenticationError);
		});

		it("should allow staff access to their own tenant", () => {
			expect(() => {
				AuthorizationService.requireTenantAccess(mockStaff, "tenant-123");
			}).not.toThrow();
		});

		it("should deny staff access to other tenants", () => {
			expect(() => {
				AuthorizationService.requireTenantAccess(mockStaff, "tenant-456");
			}).toThrow(AuthenticationError);
		});
	});

	describe("requireGlobalAdmin", () => {
		it("should allow global admin access", () => {
			expect(() => {
				AuthorizationService.requireGlobalAdmin(mockGlobalAdmin);
			}).not.toThrow();
		});

		it("should deny non-global admin access", () => {
			expect(() => {
				AuthorizationService.requireGlobalAdmin(mockTenantAdmin);
			}).toThrow(AuthenticationError);
		});
	});

	describe("requireTenantAdmin", () => {
		it("should allow global admin access", () => {
			expect(() => {
				AuthorizationService.requireTenantAdmin(mockGlobalAdmin);
			}).not.toThrow();
		});

		it("should allow tenant admin access", () => {
			expect(() => {
				AuthorizationService.requireTenantAdmin(mockTenantAdmin);
			}).not.toThrow();
		});

		it("should deny staff access", () => {
			expect(() => {
				AuthorizationService.requireTenantAdmin(mockStaff);
			}).toThrow(AuthenticationError);
		});

		it("should check tenant access for tenant admin", () => {
			expect(() => {
				AuthorizationService.requireTenantAdmin(mockTenantAdmin, "tenant-123");
			}).not.toThrow();

			expect(() => {
				AuthorizationService.requireTenantAdmin(mockTenantAdmin, "tenant-456");
			}).toThrow(AuthenticationError);
		});
	});

	describe("requireStaffOrAbove", () => {
		it("should allow all roles access", () => {
			expect(() => {
				AuthorizationService.requireStaffOrAbove(mockGlobalAdmin);
			}).not.toThrow();

			expect(() => {
				AuthorizationService.requireStaffOrAbove(mockTenantAdmin);
			}).not.toThrow();

			expect(() => {
				AuthorizationService.requireStaffOrAbove(mockStaff);
			}).not.toThrow();
		});

		it("should check tenant access for tenant-specific roles", () => {
			expect(() => {
				AuthorizationService.requireStaffOrAbove(mockStaff, "tenant-123");
			}).not.toThrow();

			expect(() => {
				AuthorizationService.requireStaffOrAbove(mockStaff, "tenant-456");
			}).toThrow(AuthenticationError);
		});
	});

	describe("utility functions", () => {
		it("should correctly identify user roles", () => {
			expect(AuthorizationService.isGlobalAdmin(mockGlobalAdmin)).toBe(true);
			expect(AuthorizationService.isGlobalAdmin(mockTenantAdmin)).toBe(false);

			expect(AuthorizationService.isTenantAdmin(mockTenantAdmin)).toBe(true);
			expect(AuthorizationService.isTenantAdmin(mockStaff)).toBe(false);

			expect(AuthorizationService.isStaff(mockStaff)).toBe(true);
			expect(AuthorizationService.isStaff(mockTenantAdmin)).toBe(false);
		});

		it("should correctly check role membership", () => {
			expect(AuthorizationService.hasRole(mockGlobalAdmin, "GLOBAL_ADMIN")).toBe(true);
			expect(AuthorizationService.hasRole(mockGlobalAdmin, "TENANT_ADMIN")).toBe(false);

			expect(
				AuthorizationService.hasAnyRole(mockTenantAdmin, ["GLOBAL_ADMIN", "TENANT_ADMIN"])
			).toBe(true);
			expect(AuthorizationService.hasAnyRole(mockStaff, ["GLOBAL_ADMIN", "TENANT_ADMIN"])).toBe(
				false
			);
		});

		it("should correctly check tenant access", () => {
			expect(AuthorizationService.canAccessTenant(mockGlobalAdmin, "any-tenant")).toBe(true);
			expect(AuthorizationService.canAccessTenant(mockTenantAdmin, "tenant-123")).toBe(true);
			expect(AuthorizationService.canAccessTenant(mockTenantAdmin, "tenant-456")).toBe(false);
		});

		it("should correctly get user tenant ID", () => {
			expect(AuthorizationService.getUserTenantId(mockGlobalAdmin)).toBe(null);
			expect(AuthorizationService.getUserTenantId(mockTenantAdmin)).toBe("tenant-123");
			expect(AuthorizationService.getUserTenantId(mockStaff)).toBe("tenant-123");
		});
	});
});
