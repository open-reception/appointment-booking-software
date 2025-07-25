import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "../+server";
import type { RequestEvent } from "@sveltejs/kit";

// Mock dependencies
vi.mock("$lib/server/services/tenant-admin-service", () => ({
	TenantAdminService: {
		getTenantById: vi.fn()
	}
}));

vi.mock("$lib/server/services/invite-service", () => ({
	InviteService: {
		hasPendingInvite: vi.fn(),
		createInvite: vi.fn()
	}
}));

vi.mock("$lib/server/email/email-service", () => ({
	sendUserInviteEmail: vi.fn()
}));

vi.mock("$env/dynamic/private", () => ({
	env: {
		PUBLIC_APP_URL: "http://localhost:5173"
	}
}));

import { TenantAdminService } from "$lib/server/services/tenant-admin-service";
import { InviteService } from "$lib/server/services/invite-service";
import { sendUserInviteEmail } from "$lib/server/email/email-service";

describe("POST /api/auth/invite", () => {
	const mockTenant = {
		id: "12345678-1234-1234-1234-123456789012",
		shortName: "testcorp",
		longName: "Test Corporation GmbH",
		description: "A test corporation",
		databaseUrl: "postgresql://test",
		setupState: "NEW" as const,
		createdAt: new Date(),
		updatedAt: new Date(),
		logo: null
	};

	const mockTenantService = {
		tenantData: mockTenant
	};

	const mockInvitation = {
		id: "invite-123",
		inviteCode: "invite-code-123",
		email: "user@example.com",
		name: "Test User",
		role: "STAFF" as const,
		tenantId: "12345678-1234-1234-1234-123456789012",
		invitedBy: "admin-id",
		language: "de" as const,
		used: false,
		usedAt: null,
		createdUserId: null,
		createdAt: new Date(),
		updatedAt: new Date(),
		expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
	};

	const createRequestEvent = (body: any, user: any = null): Partial<RequestEvent> => ({
		request: {
			json: () => Promise.resolve(body)
		} as Request,
		locals: { user }
	});

	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(TenantAdminService.getTenantById).mockResolvedValue(mockTenantService as any);
		vi.mocked(InviteService.hasPendingInvite).mockResolvedValue(false);
		vi.mocked(InviteService.createInvite).mockResolvedValue(mockInvitation as any);
		vi.mocked(sendUserInviteEmail).mockResolvedValue();
	});

	it("should reject unauthenticated requests", async () => {
		const requestEvent = createRequestEvent({
			email: "user@example.com",
			name: "Test User",
			role: "STAFF",
			tenantId: "12345678-1234-1234-1234-123456789012"
		});

		const response = await POST(requestEvent as RequestEvent);
		const data = await response.json();

		expect(response.status).toBe(401);
		expect(data.error).toBe("Authentication required");
	});

	it("should allow global admin to invite to any tenant", async () => {
		const globalAdmin = {
			userId: "admin-id",
			role: "GLOBAL_ADMIN",
			tenantId: null
		};

		const requestEvent = createRequestEvent({
			email: "user@example.com",
			name: "Test User",
			role: "STAFF",
			tenantId: "12345678-1234-1234-1234-123456789012"
		}, globalAdmin);

		const response = await POST(requestEvent as RequestEvent);
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data.message).toBe("Invitation sent successfully");
		expect(data.email).toBe("user@example.com");
		expect(data.inviteCode).toBe("invite-code-123");
		expect(vi.mocked(InviteService.hasPendingInvite)).toHaveBeenCalledWith("user@example.com", "12345678-1234-1234-1234-123456789012");
		expect(vi.mocked(InviteService.createInvite)).toHaveBeenCalledWith(
			"user@example.com",
			"Test User",
			"STAFF",
			"12345678-1234-1234-1234-123456789012",
			"admin-id",
			"de"
		);
		expect(vi.mocked(sendUserInviteEmail)).toHaveBeenCalled();
	});

	it("should allow tenant admin to invite to their own tenant", async () => {
		const tenantAdmin = {
			userId: "tenant-admin-id",
			role: "TENANT_ADMIN",
			tenantId: "12345678-1234-1234-1234-123456789012"
		};

		const requestEvent = createRequestEvent({
			email: "user@example.com",
			name: "Test User",
			role: "STAFF",
			tenantId: "12345678-1234-1234-1234-123456789012"
		}, tenantAdmin);

		const response = await POST(requestEvent as RequestEvent);
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data.message).toBe("Invitation sent successfully");
		expect(data.inviteCode).toBe("invite-code-123");
		expect(vi.mocked(InviteService.createInvite)).toHaveBeenCalledWith(
			"user@example.com",
			"Test User",
			"STAFF",
			"12345678-1234-1234-1234-123456789012",
			"tenant-admin-id",
			"de"
		);
		expect(vi.mocked(sendUserInviteEmail)).toHaveBeenCalledWith(
			"user@example.com",
			"Test User",
			mockTenant,
			"STAFF",
			expect.stringContaining("invite=invite-code-123"),
			"de"
		);
	});

	it("should reject tenant admin inviting to different tenant", async () => {
		const tenantAdmin = {
			userId: "tenant-admin-id",
			role: "TENANT_ADMIN",
			tenantId: "87654321-4321-4321-4321-210987654321"
		};

		const requestEvent = createRequestEvent({
			email: "user@example.com",
			name: "Test User",
			role: "STAFF",
			tenantId: "12345678-1234-1234-1234-123456789012"
		}, tenantAdmin);

		const response = await POST(requestEvent as RequestEvent);
		const data = await response.json();

		expect(response.status).toBe(403);
		expect(data.error).toBe("Insufficient permissions");
		expect(vi.mocked(InviteService.createInvite)).not.toHaveBeenCalled();
		expect(vi.mocked(sendUserInviteEmail)).not.toHaveBeenCalled();
	});

	it("should reject staff members from inviting", async () => {
		const staff = {
			userId: "staff-id",
			role: "STAFF",
			tenantId: "12345678-1234-1234-1234-123456789012"
		};

		const requestEvent = createRequestEvent({
			email: "user@example.com",
			name: "Test User",
			role: "STAFF",
			tenantId: "12345678-1234-1234-1234-123456789012"
		}, staff);

		const response = await POST(requestEvent as RequestEvent);
		const data = await response.json();

		expect(response.status).toBe(403);
		expect(data.error).toBe("Insufficient permissions");
		expect(vi.mocked(InviteService.createInvite)).not.toHaveBeenCalled();
		expect(vi.mocked(sendUserInviteEmail)).not.toHaveBeenCalled();
	});

	it("should validate request data", async () => {
		const globalAdmin = {
			userId: "admin-id",
			role: "GLOBAL_ADMIN",
			tenantId: null
		};

		const requestEvent = createRequestEvent({
			email: "invalid-email",
			name: "",
			role: "INVALID_ROLE",
			tenantId: "invalid-uuid"
		}, globalAdmin);

		const response = await POST(requestEvent as RequestEvent);
		const data = await response.json();

		expect(response.status).toBe(400);
		expect(data.error).toBe("Invalid request data");
		expect(vi.mocked(InviteService.createInvite)).not.toHaveBeenCalled();
		expect(vi.mocked(sendUserInviteEmail)).not.toHaveBeenCalled();
	});

	it("should reject if user already has pending invitation", async () => {
		const globalAdmin = {
			userId: "admin-id",
			role: "GLOBAL_ADMIN",
			tenantId: null
		};

		// Mock that there's already a pending invitation
		vi.mocked(InviteService.hasPendingInvite).mockResolvedValue(true);

		const requestEvent = createRequestEvent({
			email: "user@example.com",
			name: "Test User",
			role: "STAFF",
			tenantId: "12345678-1234-1234-1234-123456789012"
		}, globalAdmin);

		const response = await POST(requestEvent as RequestEvent);
		const data = await response.json();

		expect(response.status).toBe(409);
		expect(data.error).toBe("User already has a pending invitation for this tenant");
		expect(vi.mocked(InviteService.hasPendingInvite)).toHaveBeenCalledWith("user@example.com", "12345678-1234-1234-1234-123456789012");
		expect(vi.mocked(InviteService.createInvite)).not.toHaveBeenCalled();
		expect(vi.mocked(sendUserInviteEmail)).not.toHaveBeenCalled();
	});
});