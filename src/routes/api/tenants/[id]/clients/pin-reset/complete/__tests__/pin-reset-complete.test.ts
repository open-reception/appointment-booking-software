/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "../+server";

// Mock dependencies
vi.mock("$lib/server/services/client-pin-reset-service", () => ({
  ClientPinResetService: {
    forTenant: vi.fn(),
  },
}));

import { ClientPinResetService } from "$lib/server/services/client-pin-reset-service";

describe("POST /api/tenants/[id]/clients/pin-reset/complete", () => {
  const tenantId = "12345678-1234-4234-8234-123456789012";
  const mockToken = "abcdef01-2345-6789-abcd-ef0123456789";
  const tunnelId = "tunnel-12345678-1234-4234-8234-123456789012";

  const mockPinResetService = {
    completePinReset: vi.fn(),
  };

  const validRequestBody = {
    token: mockToken,
    newClientPublicKey: "base64encodedpublickey",
    newPrivateKeyShare: "base64encodedprivatekeyshare",
    newClientEncryptedTunnelKey: "hexencodedencryptedkey",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(ClientPinResetService.forTenant).mockResolvedValue(mockPinResetService as any);
  });

  it("should complete PIN reset successfully", async () => {
    mockPinResetService.completePinReset.mockResolvedValue(tunnelId);

    const request = new Request("http://localhost/api", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validRequestBody),
    });

    const result = await POST({
      params: { id: tenantId },
      request,
      locals: {} as any,
    } as any);

    expect(result.status).toBe(200);
    const data = await result.json();

    expect(data).toEqual({
      success: true,
      tunnelId,
      message: "PIN reset completed successfully",
    });

    expect(ClientPinResetService.forTenant).toHaveBeenCalledWith(tenantId);
    expect(mockPinResetService.completePinReset).toHaveBeenCalledWith(
      mockToken,
      "base64encodedpublickey",
      "base64encodedprivatekeyshare",
      "hexencodedencryptedkey",
    );
  });

  it("should return 400 for missing required fields", async () => {
    const incompleteBody = {
      token: mockToken,
      newClientPublicKey: "base64encodedpublickey",
      // Missing other required fields
    };

    const request = new Request("http://localhost/api", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(incompleteBody),
    });

    const result = await POST({
      params: { id: tenantId },
      request,
      locals: {} as any,
    } as any);

    expect(result.status).toBe(400);
    const data = await result.json();
    expect(data).toHaveProperty("error");
  });

  it("should return 400 for invalid token format", async () => {
    const invalidBody = {
      ...validRequestBody,
      token: "not-a-uuid",
    };

    const request = new Request("http://localhost/api", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(invalidBody),
    });

    const result = await POST({
      params: { id: tenantId },
      request,
      locals: {} as any,
    } as any);

    expect(result.status).toBe(400);
    const data = await result.json();
    expect(data).toHaveProperty("error");
  });

  it("should return 404 when token not found", async () => {
    mockPinResetService.completePinReset.mockRejectedValue(new Error("Invalid reset token"));

    const request = new Request("http://localhost/api", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validRequestBody),
    });

    const result = await POST({
      params: { id: tenantId },
      request,
      locals: {} as any,
    } as any);

    expect(result.status).toBe(500);
  });
});
