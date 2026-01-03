/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "../+server";

// Mock dependencies
vi.mock("$lib/server/services/client-pin-reset-service", () => ({
  ClientPinResetService: {
    forTenant: vi.fn(),
  },
}));

vi.mock("$lib/server/utils/permissions", () => ({
  checkPermission: vi.fn(),
}));

import { ClientPinResetService } from "$lib/server/services/client-pin-reset-service";
import { checkPermission } from "$lib/server/utils/permissions";

describe("POST /api/tenants/[id]/clients/pin-reset/init", () => {
  const tenantId = "12345678-1234-4234-8234-123456789012";
  const emailHash = "2c26b46b68ffc68ff99b453c1d30413413422d706483bfa0f98a5e886266e7ae";
  const mockToken = "abcdef01-2345-6789-abcd-ef0123456789";

  const mockPinResetService = {
    createResetToken: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(checkPermission).mockResolvedValue(undefined);
    vi.mocked(ClientPinResetService.forTenant).mockResolvedValue(mockPinResetService as any);
  });

  it("should create PIN reset token successfully", async () => {
    mockPinResetService.createResetToken.mockResolvedValue(mockToken);

    const request = new Request("http://localhost/api", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emailHash }),
    });

    const result = await POST({
      params: { id: tenantId },
      request,
      locals: { user: { id: "staff-123", role: "STAFF" } } as any,
    } as any);

    expect(result.status).toBe(200);
    const data = await result.json();

    expect(data).toHaveProperty("token", mockToken);
    expect(data).toHaveProperty("expiresAt");
    expect(data).toHaveProperty("expirationMinutes", 30);

    expect(checkPermission).toHaveBeenCalledWith(
      { user: { id: "staff-123", role: "STAFF" } },
      tenantId,
    );
    expect(ClientPinResetService.forTenant).toHaveBeenCalledWith(tenantId);
    expect(mockPinResetService.createResetToken).toHaveBeenCalledWith(emailHash, 30);
  });

  it("should return 400 for invalid email hash", async () => {
    const request = new Request("http://localhost/api", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emailHash: "invalid" }),
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

  it("should return 404 when client not found", async () => {
    mockPinResetService.createResetToken.mockRejectedValue(new Error("Client not found"));

    const request = new Request("http://localhost/api", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emailHash }),
    });

    const result = await POST({
      params: { id: tenantId },
      request,
      locals: { user: { id: "staff-123", role: "STAFF" } } as any,
    } as any);

    expect(result.status).toBe(500);
  });

  it("should check permissions", async () => {
    vi.mocked(checkPermission).mockRejectedValue(new Error("Forbidden"));

    const request = new Request("http://localhost/api", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emailHash }),
    });

    const response = await POST({
      params: { id: tenantId },
      request,
      locals: { user: { id: "user-123", role: "STAFF" } } as any,
    } as any);

    expect(response.status).toBe(500);

    expect(checkPermission).toHaveBeenCalledWith(
      { user: { id: "user-123", role: "STAFF" } },
      tenantId,
    );
  });
});
