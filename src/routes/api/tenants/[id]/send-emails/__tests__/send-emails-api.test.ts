/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RequestEvent } from "@sveltejs/kit";
import { EMAIL_TYPE } from "$lib/const/email";
import { AuthenticationError, AuthorizationError, ValidationError } from "$lib/server/utils/errors";
import { POST } from "../+server";

vi.mock("$lib/server/services/appointment-service", () => ({
  AppointmentService: {
    forTenant: vi.fn(),
  },
}));

vi.mock("$lib/server/services/tenant-admin-service", () => ({
  TenantAdminService: {
    getTenantById: vi.fn(),
  },
}));

vi.mock("$lib/server/utils/permissions", () => ({
  checkPermission: vi.fn(),
}));

vi.mock("$lib/server/openapi", () => ({ registerOpenAPIRoute: vi.fn() }));

vi.mock("$lib/logger", () => ({
  logger: {
    setContext: vi.fn(() => ({ debug: vi.fn(), error: vi.fn() })),
  },
}));

import { AppointmentService } from "$lib/server/services/appointment-service";
import { TenantAdminService } from "$lib/server/services/tenant-admin-service";
import { checkPermission } from "$lib/server/utils/permissions";

describe("Send Email API", () => {
  const mockTenantId = "123e4567-e89b-12d3-a456-426614174000";
  const mockAppointmentId = "123e4567-e89b-12d3-a456-426614174001";
  const mockTenant = { id: mockTenantId, shortName: "test-practice" };
  const mockAppointmentService = { getAppointmentById: vi.fn(), sendAppointmentReminder: vi.fn() };
  const validBody = {
    emails: [
      {
        type: EMAIL_TYPE.APPOINTMENT_REMINDER,
        appointment: {
          id: mockAppointmentId,
          name: "Ada Lovelace",
          email: "ada@example.com",
          locale: "de",
        },
      },
    ],
  };

  const createEvent = (
    body: unknown = validBody,
    overrides: Partial<RequestEvent> = {},
  ): RequestEvent =>
    ({
      params: { id: mockTenantId },
      locals: {
        user: { id: "staff-123", tenantId: mockTenantId, role: "STAFF" },
      },
      request: new Request("http://localhost/api/tenants/send-emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
      ...overrides,
    }) as any;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(checkPermission).mockImplementation(() => {});
    vi.mocked(TenantAdminService.getTenantById).mockResolvedValue({
      tenantData: mockTenant,
    } as any);
    vi.mocked(AppointmentService.forTenant).mockResolvedValue(mockAppointmentService as any);
    mockAppointmentService.getAppointmentById.mockImplementation((id: string) =>
      Promise.resolve({ id }),
    );
    mockAppointmentService.sendAppointmentReminder.mockResolvedValue({ id: mockAppointmentId });
  });

  describe("POST /api/tenants/[id]/send-emails", () => {
    it("sends every appointment reminder in the batch", async () => {
      const secondAppointmentId = "123e4567-e89b-12d3-a456-426614174002";
      const body = {
        emails: [
          ...validBody.emails,
          {
            type: EMAIL_TYPE.APPOINTMENT_REMINDER,
            appointment: {
              id: secondAppointmentId,
              name: "Grace Hopper",
              email: "grace@example.com",
              locale: "en",
            },
          },
        ],
      };

      const response = await POST(createEvent(body));

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({});
      expect(checkPermission).toHaveBeenCalledWith(
        expect.objectContaining({ user: expect.any(Object) }),
        mockTenantId,
        true,
      );
      expect(TenantAdminService.getTenantById).toHaveBeenCalledWith(mockTenantId);
      expect(AppointmentService.forTenant).toHaveBeenCalledWith(mockTenantId);
      expect(mockAppointmentService.getAppointmentById).toHaveBeenCalledWith(mockAppointmentId);
      expect(mockAppointmentService.getAppointmentById).toHaveBeenCalledWith(secondAppointmentId);
      expect(mockAppointmentService.sendAppointmentReminder).toHaveBeenCalledWith(
        mockTenant,
        mockAppointmentId,
        { name: "Ada Lovelace", email: "ada@example.com", locale: "de" },
      );
      expect(mockAppointmentService.sendAppointmentReminder).toHaveBeenCalledWith(
        mockTenant,
        secondAppointmentId,
        { name: "Grace Hopper", email: "grace@example.com", locale: "en" },
      );
    });

    it("allows tenant administrators to send reminders", async () => {
      const response = await POST(
        createEvent(validBody, {
          locals: {
            user: { id: "admin-123", tenantId: mockTenantId, role: "TENANT_ADMIN" },
          } as any,
        }),
      );

      expect(response.status).toBe(200);
      expect(mockAppointmentService.sendAppointmentReminder).toHaveBeenCalledOnce();
    });

    it("rejects unauthenticated requests", async () => {
      await expect(
        POST(createEvent(validBody, { locals: { user: null } as any })),
      ).rejects.toBeInstanceOf(AuthenticationError);
    });

    it("rejects requests without a tenant ID", async () => {
      await expect(
        POST(
          createEvent(validBody, { locals: { user: { id: "staff-123", role: "STAFF" } } as any }),
        ),
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it("propagates permission failures", async () => {
      vi.mocked(checkPermission).mockImplementation(() => {
        throw new AuthorizationError("Insufficient permissions");
      });

      await expect(POST(createEvent())).rejects.toBeInstanceOf(AuthorizationError);
    });

    it("rejects roles other than staff and tenant admin", async () => {
      await expect(
        POST(
          createEvent(validBody, {
            locals: { user: { id: "user-123", tenantId: mockTenantId, role: "USER" } } as any,
          }),
        ),
      ).rejects.toBeInstanceOf(AuthorizationError);
    });

    it("returns a validation error for an invalid email queue", async () => {
      const response = await POST(createEvent({ emails: [{ type: "INVALID" }] }));

      expect(response.status).toBe(422);
      expect(await response.json()).toHaveProperty("error");
      expect(TenantAdminService.getTenantById).not.toHaveBeenCalled();
    });

    it("returns a backend error when the tenant no longer exists", async () => {
      vi.mocked(TenantAdminService.getTenantById).mockResolvedValue({ tenantData: null } as any);

      const response = await POST(createEvent());

      expect(response.status).toBe(500);
      expect(await response.json()).toMatchObject({ error: "Tenant not found" });
      expect(AppointmentService.forTenant).not.toHaveBeenCalled();
    });

    it("returns an internal error when appointment lookup fails", async () => {
      mockAppointmentService.getAppointmentById.mockRejectedValue(
        new Error("Database unavailable"),
      );

      const response = await POST(createEvent());

      expect(response.status).toBe(500);
      expect(await response.json()).toHaveProperty("error");
      expect(mockAppointmentService.sendAppointmentReminder).not.toHaveBeenCalled();
    });

    it("returns an internal error when email delivery fails", async () => {
      mockAppointmentService.sendAppointmentReminder.mockRejectedValue(
        new Error("Email provider unavailable"),
      );

      const response = await POST(createEvent());

      expect(response.status).toBe(500);
      expect(await response.json()).toHaveProperty("error");
    });
  });
});
