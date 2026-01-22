/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { DELETE } from "../+server";
import * as appointmentService from "$lib/server/services/appointment-service";
import { NotFoundError } from "$lib/server/utils/errors";

// Mock the appointment service
vi.mock("$lib/server/services/appointment-service", () => ({
  AppointmentService: {
    forTenant: vi.fn(),
  },
}));

// Mock permission check
vi.mock("$lib/server/utils/permissions", () => ({
  checkPermission: vi.fn(),
}));

// Mock logger
vi.mock("$lib/logger", () => ({
  default: {
    setContext: vi.fn(() => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    })),
  },
}));

describe("DELETE /api/tenants/[id]/appointments/[appointmentId]/delete", () => {
  const mockTenantId = "tenant-123";
  const mockAppointmentId = "appointment-456";
  const mockClientEmail = "client@example.com";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should delete appointment successfully with valid data", async () => {
    const mockDeleteAppointmentByStaff = vi.fn().mockResolvedValue(undefined);

    vi.mocked(appointmentService.AppointmentService.forTenant).mockResolvedValue({
      deleteAppointmentByStaff: mockDeleteAppointmentByStaff,
    } as any);

    const request = new Request("http://localhost", {
      method: "DELETE",
      body: JSON.stringify({
        clientEmail: mockClientEmail,
        clientLanguage: "de",
      }),
      headers: {
        "Content-Type": "application/json",
      },
    });

    const response = await DELETE({
      params: { id: mockTenantId, appointmentId: mockAppointmentId },
      request,
      locals: { user: { id: "user-123" } },
    } as any);

    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result).toEqual({
      message: "Appointment deleted successfully",
    });
    expect(mockDeleteAppointmentByStaff).toHaveBeenCalledWith(
      mockAppointmentId,
      mockClientEmail,
      "de",
    );
  });

  it("should use default language when not provided", async () => {
    const mockDeleteAppointmentByStaff = vi.fn().mockResolvedValue(undefined);

    vi.mocked(appointmentService.AppointmentService.forTenant).mockResolvedValue({
      deleteAppointmentByStaff: mockDeleteAppointmentByStaff,
    } as any);

    const request = new Request("http://localhost", {
      method: "DELETE",
      body: JSON.stringify({
        clientEmail: mockClientEmail,
      }),
      headers: {
        "Content-Type": "application/json",
      },
    });

    const response = await DELETE({
      params: { id: mockTenantId, appointmentId: mockAppointmentId },
      request,
      locals: { user: { id: "user-123" } },
    } as any);

    expect(response.status).toBe(200);
    expect(mockDeleteAppointmentByStaff).toHaveBeenCalledWith(
      mockAppointmentId,
      mockClientEmail,
      "de",
    );
  });

  it("should return 422 when clientEmail is missing", async () => {
    const request = new Request("http://localhost", {
      method: "DELETE",
      body: JSON.stringify({}),
      headers: {
        "Content-Type": "application/json",
      },
    });

    const response = await DELETE({
      params: { id: mockTenantId, appointmentId: mockAppointmentId },
      request,
      locals: { user: { id: "user-123" } },
    } as any);

    expect(response.status).toBe(422);
  });

  it("should return 422 when clientEmail is invalid", async () => {
    const request = new Request("http://localhost", {
      method: "DELETE",
      body: JSON.stringify({
        clientEmail: "invalid-email",
      }),
      headers: {
        "Content-Type": "application/json",
      },
    });

    const response = await DELETE({
      params: { id: mockTenantId, appointmentId: mockAppointmentId },
      request,
      locals: { user: { id: "user-123" } },
    } as any);

    expect(response.status).toBe(422);
  });

  it("should return 422 when tenantId is missing", async () => {
    const request = new Request("http://localhost", {
      method: "DELETE",
      body: JSON.stringify({
        clientEmail: mockClientEmail,
      }),
      headers: {
        "Content-Type": "application/json",
      },
    });

    const response = await DELETE({
      params: { appointmentId: mockAppointmentId },
      request,
      locals: { user: { id: "user-123" } },
    } as any);

    expect(response.status).toBe(422);
  });

  it("should return 422 when appointmentId is missing", async () => {
    const request = new Request("http://localhost", {
      method: "DELETE",
      body: JSON.stringify({
        clientEmail: mockClientEmail,
      }),
      headers: {
        "Content-Type": "application/json",
      },
    });

    const response = await DELETE({
      params: { id: mockTenantId },
      request,
      locals: { user: { id: "user-123" } },
    } as any);

    expect(response.status).toBe(422);
  });

  it("should return 404 when appointment is not found", async () => {
    const mockDeleteAppointmentByStaff = vi
      .fn()
      .mockRejectedValue(new NotFoundError("Appointment not found"));

    vi.mocked(appointmentService.AppointmentService.forTenant).mockResolvedValue({
      deleteAppointmentByStaff: mockDeleteAppointmentByStaff,
    } as any);

    const request = new Request("http://localhost", {
      method: "DELETE",
      body: JSON.stringify({
        clientEmail: mockClientEmail,
      }),
      headers: {
        "Content-Type": "application/json",
      },
    });

    const response = await DELETE({
      params: { id: mockTenantId, appointmentId: mockAppointmentId },
      request,
      locals: { user: { id: "user-123" } },
    } as any);

    expect(response.status).toBe(404);
  });

  it("should handle service errors gracefully", async () => {
    const mockDeleteAppointmentByStaff = vi
      .fn()
      .mockRejectedValue(new Error("Database connection failed"));

    vi.mocked(appointmentService.AppointmentService.forTenant).mockResolvedValue({
      deleteAppointmentByStaff: mockDeleteAppointmentByStaff,
    } as any);

    const request = new Request("http://localhost", {
      method: "DELETE",
      body: JSON.stringify({
        clientEmail: mockClientEmail,
      }),
      headers: {
        "Content-Type": "application/json",
      },
    });

    const response = await DELETE({
      params: { id: mockTenantId, appointmentId: mockAppointmentId },
      request,
      locals: { user: { id: "user-123" } },
    } as any);

    expect(response.status).toBe(500);
  });
});
