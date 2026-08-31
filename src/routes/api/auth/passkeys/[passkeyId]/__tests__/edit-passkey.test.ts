/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { RequestEvent } from "@sveltejs/kit";

const mockLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

vi.mock("$lib/server/auth/webauthn-service", () => ({
  WebAuthnService: {
    getUserPasskeys: vi.fn(),
  },
}));

vi.mock("$lib/server/services/user-service", () => ({
  UserService: {
    updatePasskey: vi.fn(),
  },
}));

vi.mock("$lib/server/services/staff-crypto.service", () => ({
  StaffCryptoService: vi.fn(),
}));

vi.mock("$lib/server/openapi", () => ({
  registerOpenAPIRoute: vi.fn(),
}));

vi.mock("$lib/logger", () => ({
  default: {
    setContext: vi.fn(() => mockLogger),
  },
}));

import { PUT } from "../+server";
import { UserService } from "$lib/server/services/user-service";
import { WebAuthnService } from "$lib/server/auth/webauthn-service";
import type { SelectUserPasskey } from "$lib/server/db/central-schema";

describe("Edit Passkey API", () => {
  const mockUserId = "456e7890-e89b-12d3-a456-426614174001";
  const mockPasskeyId = "passkey_abc123def456";
  const mockTenantId = "123e4567-e89b-12d3-a456-426614174000";

  const mockOwnedPasskey: SelectUserPasskey = {
    id: mockPasskeyId,
    userId: mockUserId,
    deviceName: "Original Device",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastUsedAt: new Date(),
    counter: 0,
    publicKey: "public-key",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(WebAuthnService.getUserPasskeys).mockResolvedValue([mockOwnedPasskey]);
    vi.mocked(UserService.updatePasskey).mockResolvedValue({
      ...mockOwnedPasskey,
      deviceName: "Renamed Device",
    });
  });

  function createMockRequestEvent(overrides: Partial<RequestEvent> = {}): RequestEvent {
    return {
      params: { passkeyId: mockPasskeyId },
      locals: {
        user: {
          id: mockUserId,
          tenantId: mockTenantId,
          passkeyId: mockPasskeyId,
        },
      },
      request: {
        json: vi.fn().mockResolvedValue({
          deviceName: "Renamed Device",
        }),
      } as any,
      ...overrides,
    } as RequestEvent;
  }

  describe("PUT /api/auth/passkeys/[passkeyId]", () => {
    it("updates a passkey device name for an authenticated user who owns it", async () => {
      const event = createMockRequestEvent();

      const response = await PUT(event);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ deviceName: "Renamed Device" });
      expect(WebAuthnService.getUserPasskeys).toHaveBeenCalledWith(mockUserId);
      expect(UserService.updatePasskey).toHaveBeenCalledWith(mockPasskeyId, {
        deviceName: "Renamed Device",
      });
    });

    it("rejects unauthenticated requests with authentication required", async () => {
      const event = createMockRequestEvent({
        locals: { user: null } as any,
      });

      const response = await PUT(event);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe("Authentication required");
      expect(UserService.updatePasskey).not.toHaveBeenCalled();
    });

    it("rejects requests that do not include a passkeyId path parameter", async () => {
      const event = createMockRequestEvent({
        params: { passkeyId: undefined as unknown as string },
      });

      const response = await PUT(event);
      const data = await response.json();

      expect(response.status).toBe(422);
      expect(data.error).toBe("Passkey ID is required");
    });

    it("rejects requests where deviceName is missing from the body", async () => {
      const event = createMockRequestEvent({
        request: {
          json: vi.fn().mockResolvedValue({}),
        } as any,
      });

      const response = await PUT(event);
      const data = await response.json();

      expect(response.status).toBe(422);
      expect(data.error).toBe("deviceName is required");
      expect(UserService.updatePasskey).not.toHaveBeenCalled();
    });

    it("returns 404 when the passkey does not belong to the authenticated user", async () => {
      vi.mocked(WebAuthnService.getUserPasskeys).mockResolvedValue([]);

      const event = createMockRequestEvent();

      const response = await PUT(event);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("Passkey not found or does not belong to you");
      expect(UserService.updatePasskey).not.toHaveBeenCalled();
    });

    it("returns 404 when the update service cannot persist the rename", async () => {
      vi.mocked(UserService.updatePasskey).mockResolvedValue(null as any);

      const event = createMockRequestEvent();

      const response = await PUT(event);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("Failed to update passkey");
    });

    it("returns 500 when an unexpected error occurs during the update flow", async () => {
      vi.mocked(WebAuthnService.getUserPasskeys).mockRejectedValue(new Error("db unavailable"));

      const event = createMockRequestEvent();

      const response = await PUT(event);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Internal server error");
    });
  });
});
