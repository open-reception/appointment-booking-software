/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCheckPermission = vi.hoisted(() => vi.fn());
const mockLogger = vi.hoisted(() => ({
  setContext: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

const mockCentralDb = vi.hoisted(() => ({
  select: vi.fn(),
}));

const mockGetTenantDb = vi.hoisted(() => vi.fn());

vi.mock("$lib/logger", () => ({
  logger: {
    ...mockLogger,
    setContext: vi.fn().mockImplementation(() => mockLogger),
  },
}));

vi.mock("$lib/server/openapi", () => ({
  registerOpenAPIRoute: vi.fn(),
}));

vi.mock("$lib/server/db", () => ({
  centralDb: mockCentralDb,
  getTenantDb: mockGetTenantDb,
}));

vi.mock("$lib/server/db/central-schema", () => ({
  user: {
    id: "id",
    tenantId: "tenantId",
    isActive: "isActive",
    role: "role",
    confirmationState: "confirmationState",
  },
}));

vi.mock("$lib/server/db/tenant-schema", () => ({
  clientTunnelStaffKeyShare: {
    userId: "userId",
    tunnelId: "tunnelId",
    encryptedTunnelKey: "encryptedTunnelKey",
    passkeyId: "passkeyId",
  },
}));

vi.mock("$lib/server/utils/permissions", () => ({
  checkPermission: mockCheckPermission,
}));

import { GET } from "../+server";

const mockTenantId = "123e4567-e89b-12d3-a456-426614174000";
const mockStaffUserId = "456e7890-e89b-12d3-a456-426614174001";
const mockTunnelId = "789e0123-e89b-12d3-a456-426614174002";

const createSelectChain = (result: unknown) => ({
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  limit: vi.fn().mockResolvedValue(result),
});

const createTenantDbResult = (rows: unknown[]) => ({
  select: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(rows),
        then: (resolve: (value: unknown[]) => unknown) => resolve(rows),
      }),
    }),
  }),
});

const buildEvent = (locals: Record<string, unknown>, tenantId?: string, tunnelId?: string) =>
  ({
    params: { id: tenantId, tunnelId },
    locals,
  }) as any;

describe("Get Staff Key Shares API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckPermission.mockImplementation(() => undefined);
    mockLogger.setContext.mockImplementation(() => mockLogger);
  });

  it("returns the staff key shares for the current staff user and tunnel", async () => {
    const mockStaffUser = {
      id: mockStaffUserId,
      tenantId: mockTenantId,
      isActive: true,
      role: "STAFF",
      confirmationState: "ACCESS_GRANTED",
    };

    mockCentralDb.select.mockReturnValue(createSelectChain([mockStaffUser]));

    mockGetTenantDb.mockResolvedValue(
      createTenantDbResult([
        {
          tunnelId: mockTunnelId,
          encryptedTunnelKey: "encrypted-key-share",
          passkeyId: "passkey-id",
        },
      ]),
    );

    const response = await GET(
      buildEvent(
        {
          user: { id: mockStaffUserId, tenantId: mockTenantId, role: "STAFF" },
        },
        mockTenantId,
        mockTunnelId,
      ),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      keyShares: [
        {
          tunnelId: mockTunnelId,
          encryptedTunnelKey: "encrypted-key-share",
          passkeyId: "passkey-id",
        },
      ],
    });
    expect(mockCheckPermission).toHaveBeenCalledWith(
      { user: { id: mockStaffUserId, tenantId: mockTenantId, role: "STAFF" } },
      mockTenantId,
    );
    expect(mockGetTenantDb).toHaveBeenCalledWith(mockTenantId);
  });

  it("rejects when the staff user does not have access to the requested tunnel", async () => {
    const mockStaffUser = {
      id: mockStaffUserId,
      tenantId: mockTenantId,
      isActive: true,
      role: "STAFF",
      confirmationState: "ACCESS_GRANTED",
    };

    mockCentralDb.select.mockReturnValue(createSelectChain([mockStaffUser]));
    mockGetTenantDb.mockResolvedValue(createTenantDbResult([]));

    const response = await GET(
      buildEvent(
        {
          user: { id: mockStaffUserId, tenantId: mockTenantId, role: "STAFF" },
        },
        mockTenantId,
        mockTunnelId,
      ),
    );

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body).toEqual({
      error: "User does not have access to this tunnel or tunnel does not exist",
      message: "User does not have access to this tunnel or tunnel does not exist",
    });
  });

  it("rejects when tenant id is missing", async () => {
    await expect(
      GET(
        buildEvent(
          {
            user: { id: mockStaffUserId, tenantId: mockTenantId, role: "STAFF" },
          },
          undefined,
        ),
      ),
    ).rejects.toThrow("Tenant ID is required");
  });

  it("rejects when tunnel id is missing", async () => {
    await expect(
      GET(
        buildEvent(
          {
            user: { id: mockStaffUserId, tenantId: mockTenantId, role: "STAFF" },
          },
          mockTenantId,
          undefined,
        ),
      ),
    ).rejects.toThrow("Tunnel ID is required");
  });

  it("rejects when the current user is not in locals", async () => {
    await expect(
      GET(
        buildEvent(
          {
            user: null,
          },
          mockTenantId,
          mockTunnelId,
        ),
      ),
    ).rejects.toThrow("User ID is required");
  });

  it("rejects when the staff user record is not found in the central database", async () => {
    mockCentralDb.select.mockReturnValue(createSelectChain([]));

    const response = await GET(
      buildEvent(
        {
          user: { id: mockStaffUserId, tenantId: mockTenantId, role: "STAFF" },
        },
        mockTenantId,
        mockTunnelId,
      ),
    );

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body).toEqual({ error: "User not found", message: "User not found" });
  });

  it("rejects when the staff user belongs to a different tenant", async () => {
    mockCentralDb.select.mockReturnValue(
      createSelectChain([
        {
          id: mockStaffUserId,
          tenantId: "different-tenant",
          isActive: true,
          role: "STAFF",
          confirmationState: "ACCESS_GRANTED",
        },
      ]),
    );

    const response = await GET(
      buildEvent(
        {
          user: { id: mockStaffUserId, tenantId: mockTenantId, role: "STAFF" },
        },
        mockTenantId,
        mockTunnelId,
      ),
    );

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body).toEqual({
      error: "Staff user does not belong to this tenant",
      message: "Staff user does not belong to this tenant",
    });
  });

  it("rejects when the staff user is inactive", async () => {
    mockCentralDb.select.mockReturnValue(
      createSelectChain([
        {
          id: mockStaffUserId,
          tenantId: mockTenantId,
          isActive: false,
          role: "STAFF",
          confirmationState: "ACCESS_GRANTED",
        },
      ]),
    );

    const response = await GET(
      buildEvent(
        {
          user: { id: mockStaffUserId, tenantId: mockTenantId, role: "STAFF" },
        },
        mockTenantId,
        mockTunnelId,
      ),
    );

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body).toEqual({ error: "Staff user is inactive", message: "Staff user is inactive" });
  });

  it("returns a 500 response when the tenant database query fails unexpectedly", async () => {
    mockCentralDb.select.mockReturnValue(
      createSelectChain([
        {
          id: mockStaffUserId,
          tenantId: mockTenantId,
          isActive: true,
          role: "STAFF",
          confirmationState: "ACCESS_GRANTED",
        },
      ]),
    );
    mockGetTenantDb.mockRejectedValue(new Error("database unavailable"));

    const response = await GET(
      buildEvent(
        {
          user: { id: mockStaffUserId, tenantId: mockTenantId, role: "STAFF" },
        },
        mockTenantId,
        mockTunnelId,
      ),
    );

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toEqual({ error: "Internal server error", message: "Internal server error" });
  });

  it("propagates permission failures before any database access occurs", async () => {
    mockCheckPermission.mockImplementation(() => {
      throw new Error("permission denied");
    });

    await expect(
      GET(
        buildEvent(
          {
            user: { id: mockStaffUserId, tenantId: mockTenantId, role: "STAFF" },
          },
          mockTenantId,
          mockTunnelId,
        ),
      ),
    ).rejects.toThrow("permission denied");

    expect(mockCentralDb.select).not.toHaveBeenCalled();
  });
});
