/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "../+server";

// Mock dependencies
vi.mock("$lib/server/services/client-pin-reset-service", () => ({
  ClientPinResetService: {
    forTenant: vi.fn(),
  },
}));

vi.mock("$lib/server/email/email-service", () => ({
  sendPinResetEmail: vi.fn(),
}));

vi.mock("$lib/server/utils/permissions", () => ({
  checkPermission: vi.fn(),
}));

vi.mock("$lib/server/db", () => {
  const rows = [
    {
      tenantId: "tenant-123",
      longName: "tenant",
    },
  ];
  return {
    getTenant: vi.fn(),
    centralDb: {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            then: (resolve: any) => resolve(rows),
            limit: vi.fn(() => Promise.resolve(rows)),
          })),
        })),
      })),
      update: vi.fn(() => ({
        where: vi.fn(() => {}),
      })),
      where: vi.fn(),
    },
  };
});

vi.mock("$env/dynamic/private", () => ({
  env: {
    PUBLIC_APP_URL: "http://localhost:5173",
    DATABASE_URL: "postgresql://test:test@localhost:5432/test",
  },
}));

import { ClientPinResetService } from "$lib/server/services/client-pin-reset-service";
import { checkPermission } from "$lib/server/utils/permissions";
import { getTenant } from "$lib/server/db";

describe("POST /api/tenants/[id]/clients/pin-reset/request", () => {
  const tenantId = "12345678-1234-4234-8234-123456789012";
  const emailHash = "2c26b46b68ffc68ff99b453c1d30413413422d706483bfa0f98a5e886266e7ae";
  const mockToken = "abcdef01-2345-6789-abcd-ef0123456789";

  const mockTenant = {
    id: tenantId,
    shortName: "testcorp",
    longName: "Test Corporation",
    databaseUrl: "postgresql://test",
  };

  const mockPinResetService = {
    createResetToken: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(checkPermission).mockResolvedValue(undefined);
    vi.mocked(getTenant).mockResolvedValue(mockTenant as any);
    vi.mocked(ClientPinResetService.forTenant).mockResolvedValue(mockPinResetService as any);
  });

  it("should create PIN reset token and return URL", async () => {
    mockPinResetService.createResetToken.mockResolvedValue(mockToken);

    const request = new Request("http://localhost/api", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emailHash, email: "hi@example.com", clientLanguage: "de" }),
    });

    const result = await POST({
      params: { id: tenantId },
      request,
      locals: { user: { id: "staff-123", role: "STAFF" } } as any,
    } as any);

    expect(result.status).toBe(200);
    const data = await result.json();

    expect(data).toHaveProperty("message");
    expect(data).toHaveProperty("emailHash", emailHash.slice(0, 8));

    expect(checkPermission).toHaveBeenCalledWith(
      { user: { id: "staff-123", role: "STAFF" } },
      tenantId,
    );
    expect(ClientPinResetService.forTenant).toHaveBeenCalledWith(tenantId);
    expect(mockPinResetService.createResetToken).toHaveBeenCalledWith(emailHash, 60);
  });

  it("should use default language when not provided", async () => {
    mockPinResetService.createResetToken.mockResolvedValue(mockToken);

    const request = new Request("http://localhost/api", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emailHash, email: "hi@example.com" }),
    });

    const result = await POST({
      params: { id: tenantId },
      request,
      locals: { user: { id: "staff-123", role: "STAFF" } } as any,
    } as any);

    expect(result.status).toBe(200);
  });

  it("should return 400 for invalid email hash", async () => {
    const request = new Request("http://localhost/api", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "hello@example.com", emailHash: "invalid" }),
    });

    const result = await POST({
      params: { id: tenantId },
      request,
      locals: { user: { id: "staff-123", role: "STAFF" } } as any,
    } as any);

    expect(result.status).toBe(400);
    const data = await result.json();
    expect(data).toHaveProperty("error");
  });

  it("should check permissions", async () => {
    vi.mocked(checkPermission).mockRejectedValue(new Error("Forbidden"));

    const request = new Request("http://localhost/api", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emailHash, email: "hello@example.com" }),
    });

    const response = await POST({
      params: { id: tenantId },
      request,
      locals: { user: { id: "user-123", role: "GLOBAL_ADMIN" } } as any,
    } as any);

    expect(response.status).toBe(403);

    expect(checkPermission).toHaveBeenCalledWith(
      { user: { id: "user-123", role: "GLOBAL_ADMIN" } },
      tenantId,
    );
  });
});
