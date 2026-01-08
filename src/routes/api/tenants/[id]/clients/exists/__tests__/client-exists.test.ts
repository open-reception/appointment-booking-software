/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "../+server";

// Mock dependencies
vi.mock("$lib/server/services/appointment-service", () => ({
  AppointmentService: {
    forTenant: vi.fn(),
  },
}));

vi.mock("$lib/server/utils/permissions", () => ({
  checkPermission: vi.fn(),
}));

import { AppointmentService } from "$lib/server/services/appointment-service";
import { checkPermission } from "$lib/server/utils/permissions";

describe("POST /api/tenants/[id]/clients/exists", () => {
  const tenantId = "12345678-1234-4234-8234-123456789012";
  const emailHash = "2c26b46b68ffc68ff99b453c1d30413413422d706483bfa0f98a5e886266e7ae";

  const mockAppointmentService = {
    getClientTunnels: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(checkPermission).mockResolvedValue(undefined);
    vi.mocked(AppointmentService.forTenant).mockResolvedValue(mockAppointmentService as any);
  });

  it("should return true when client exists", async () => {
    mockAppointmentService.getClientTunnels.mockResolvedValue([
      {
        id: "tunnel-123",
        emailHash,
        clientPublicKey: "public-key",
      },
      {
        id: "tunnel-456",
        emailHash: "different-hash",
        clientPublicKey: "public-key-2",
      },
    ]);

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

    expect(data.exists).toBe(true);
    expect(data.emailHash).toBe(emailHash.slice(0, 8));
    expect(mockAppointmentService.getClientTunnels).toHaveBeenCalled();
  });

  it("should return false when client does not exist", async () => {
    mockAppointmentService.getClientTunnels.mockResolvedValue([
      {
        id: "tunnel-456",
        emailHash: "different-hash",
        clientPublicKey: "public-key-2",
      },
    ]);

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

    expect(data.exists).toBe(false);
    expect(data.emailHash).toBe(emailHash.slice(0, 8));
  });

  it("should return false when no client tunnels exist", async () => {
    mockAppointmentService.getClientTunnels.mockResolvedValue([]);

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

    expect(data.exists).toBe(false);
  });

  it("should return 400 for invalid email hash length", async () => {
    const request = new Request("http://localhost/api", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emailHash: "short-hash" }),
    });

    const result = await POST({
      params: { id: tenantId },
      request,
      locals: { user: { id: "staff-123", role: "STAFF" } } as any,
    } as any);

    expect(result.status).toBe(400);
    const data = await result.json();
    expect(data.error).toBeDefined();
  });

  it("should return 400 for missing email hash", async () => {
    const request = new Request("http://localhost/api", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    const result = await POST({
      params: { id: tenantId },
      request,
      locals: { user: { id: "staff-123", role: "STAFF" } } as any,
    } as any);

    expect(result.status).toBe(400);
    const data = await result.json();
    expect(data.error).toBeDefined();
  });

  it("should check permissions", async () => {
    vi.mocked(checkPermission).mockRejectedValue(new Error("Permission denied"));

    const request = new Request("http://localhost/api", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emailHash }),
    });

    const result = await POST({
      params: { id: tenantId },
      request,
      locals: { user: { id: "user-123", role: "USER" } } as any,
    } as any);

    expect(result.status).toBe(500);
    expect(checkPermission).toHaveBeenCalledWith(
      { user: { id: "user-123", role: "USER" } },
      tenantId,
    );
  });

  it("should handle service errors gracefully", async () => {
    mockAppointmentService.getClientTunnels.mockRejectedValue(
      new Error("Database connection failed"),
    );

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
    const data = await result.json();
    expect(data.error).toBe("Failed to check client existence");
  });
});
