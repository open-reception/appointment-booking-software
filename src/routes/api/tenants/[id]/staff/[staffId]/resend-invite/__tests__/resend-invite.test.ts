/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from "vitest";

// Import the handler under test
import { POST } from "../+server";

// Mock dependencies that the handler uses
vi.mock("$lib/server/services/user-service", () => ({
  UserService: { resendConfirmationEmail: vi.fn() },
}));
vi.mock("$lib/server/utils/permissions", () => ({
  checkPermission: vi.fn(),
}));
vi.mock("$lib/server/openapi", () => ({ registerOpenAPIRoute: vi.fn() }));
vi.mock("$lib/logger", () => ({
  logger: { setContext: () => ({ debug: vi.fn(), error: vi.fn() }) },
}));

import { UserService } from "$lib/server/services/user-service";
import { checkPermission } from "$lib/server/utils/permissions";

describe("Staff Resend Invite API", () => {
  const mockTenantId = "123e4567-e89b-12d3-a456-426614174000";
  const mockStaffId = "456e7890-e89b-12d3-a456-426614174001";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls UserService.resendConfirmationEmail and returns 200 on success", async () => {
    (UserService.resendConfirmationEmail as any) = vi.fn().mockResolvedValue(undefined);

    const body = { email: "invitee@example.com" };
    const request = new Request("http://localhost", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

    const res = await POST({
      params: { id: mockTenantId, staffId: mockStaffId },
      locals: { user: { id: mockStaffId } },
      request,
      url: new URL("http://localhost"),
    } as any);

    expect(checkPermission).toHaveBeenCalledWith(expect.anything(), mockTenantId, true);
    expect(UserService.resendConfirmationEmail as any).toHaveBeenCalledWith(
      body.email,
      expect.any(URL),
    );
    // SvelteKit `json({})` responses expose `status`
    expect((res as Response).status).toBe(200);
  });

  it("throws ValidationError when tenant id is missing", async () => {
    const request = new Request("http://localhost", { method: "POST" });
    await expect(
      POST({
        params: { staffId: mockStaffId },
        locals: {},
        request,
        url: new URL("http://localhost"),
      } as any),
    ).rejects.toThrow();
  });

  it("throws ValidationError when staff id is missing", async () => {
    const request = new Request("http://localhost", { method: "POST" });
    await expect(
      POST({
        params: { tenantId: mockStaffId },
        locals: {},
        request,
        url: new URL("http://localhost"),
      } as any),
    ).rejects.toThrow();
  });
});
