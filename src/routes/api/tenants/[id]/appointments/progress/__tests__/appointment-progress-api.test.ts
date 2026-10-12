/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "../+server";
import type { RequestEvent } from "@sveltejs/kit";

vi.mock("$lib/server/services/appointment-service", () => ({
  AppointmentService: {
    forTenant: vi.fn(),
  },
}));

vi.mock("$lib/logger", () => ({
  default: {
    setContext: vi.fn(() => ({
      debug: vi.fn(),
      error: vi.fn(),
    })),
  },
}));

vi.mock("$lib/server/utils/permissions", () => ({
  checkPermission: vi.fn(),
}));

import { AppointmentService } from "$lib/server/services/appointment-service";
import { AuthenticationError, AuthorizationError, NotFoundError } from "$lib/server/utils/errors";
import { checkPermission } from "$lib/server/utils/permissions";

describe("Appointment Progress API Route", () => {
  const mockTenantId = "123e4567-e89b-12d3-a456-426614174000";
  const mockAppointmentService = {
    getAppointmentProgressStates: vi.fn(),
  };
  const mockProgressStates = [
    {
      id: "111e4567-e89b-12d3-a456-426614174000",
      state: "NOT_STARTED",
      group: "NOT_STARTED",
      icon: "CLOCK",
      names: { en: "Not started", de: "Nicht begonnen" },
      isLocked: true,
    },
    {
      id: "222e4567-e89b-12d3-a456-426614174000",
      state: "IN_PROGRESS",
      group: "IN_PROGRESS",
      icon: "PLAY",
      names: { en: "In progress", de: "In Bearbeitung" },
      isLocked: false,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    (AppointmentService.forTenant as any).mockResolvedValue(mockAppointmentService);
    vi.mocked(checkPermission).mockImplementation(() => {});
  });

  function createMockRequestEvent(overrides: Partial<RequestEvent> = {}): RequestEvent {
    return {
      params: { id: mockTenantId },
      locals: {
        user: {
          userId: "user123",
          role: "TENANT_ADMIN",
          tenantId: mockTenantId,
        },
      } as any,
      ...overrides,
    } as RequestEvent;
  }

  describe("GET /api/tenants/[id]/appointments/progress", () => {
    it("returns the progress states retrieved for the tenant", async () => {
      mockAppointmentService.getAppointmentProgressStates.mockResolvedValue(mockProgressStates);
      const event = createMockRequestEvent();

      const response = await GET(event);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ states: mockProgressStates });
      expect(checkPermission).toHaveBeenCalledWith(event.locals, mockTenantId, false);
      expect(AppointmentService.forTenant).toHaveBeenCalledWith(mockTenantId);
      expect(mockAppointmentService.getAppointmentProgressStates).toHaveBeenCalledOnce();
    });

    it("returns an empty states array when the tenant has no progress states", async () => {
      mockAppointmentService.getAppointmentProgressStates.mockResolvedValue([]);

      const response = await GET(createMockRequestEvent());
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ states: [] });
      expect(mockAppointmentService.getAppointmentProgressStates).toHaveBeenCalledOnce();
    });

    it("returns 422 and skips permission and service checks when the tenant ID is missing", async () => {
      const event = createMockRequestEvent({ params: { id: undefined } });

      const response = await GET(event);
      const data = await response.json();

      expect(response.status).toBe(422);
      expect(data.error).toBe("Tenant ID is required");
      expect(checkPermission).not.toHaveBeenCalled();
      expect(AppointmentService.forTenant).not.toHaveBeenCalled();
    });

    it("returns 401 when the requester is unauthenticated", async () => {
      vi.mocked(checkPermission).mockImplementationOnce(() => {
        throw new AuthenticationError("Authentication required");
      });

      const response = await GET(createMockRequestEvent());
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Authentication required");
      expect(AppointmentService.forTenant).not.toHaveBeenCalled();
    });

    it("returns 403 when the requester lacks permission for the tenant", async () => {
      vi.mocked(checkPermission).mockImplementationOnce(() => {
        throw new AuthorizationError("Insufficient permissions");
      });

      const response = await GET(createMockRequestEvent());
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe("Insufficient permissions");
      expect(AppointmentService.forTenant).not.toHaveBeenCalled();
    });

    it("returns the backend status when the tenant cannot be found", async () => {
      (AppointmentService.forTenant as any).mockRejectedValue(
        new NotFoundError("Tenant not found"),
      );

      const response = await GET(createMockRequestEvent());
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("Tenant not found");
      expect(mockAppointmentService.getAppointmentProgressStates).not.toHaveBeenCalled();
    });

    it("returns 500 when retrieving progress states fails unexpectedly", async () => {
      mockAppointmentService.getAppointmentProgressStates.mockRejectedValue(
        new Error("Database error"),
      );

      const response = await GET(createMockRequestEvent());
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Internal server error");
    });
  });
});
