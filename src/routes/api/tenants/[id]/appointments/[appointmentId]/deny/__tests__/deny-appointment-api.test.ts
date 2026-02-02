import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "../+server";
import type { RequestEvent } from "@sveltejs/kit";

vi.mock("$lib/server/services/appointment-service", () => ({
  AppointmentService: {
    forTenant: vi.fn(),
  },
}));

import { AppointmentService } from "$lib/server/services/appointment-service";

describe("POST /api/tenants/[id]/appointments/[appointmentId]/deny", () => {
  const mockTenantId = "123e4567-e89b-12d3-a456-426614174000";
  const mockAppointmentId = "456e7890-e12b-34d5-a678-901234567890";
  const mockAppointmentService = {
    denyAppointment: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (AppointmentService.forTenant as any).mockResolvedValue(mockAppointmentService);
  });

  function createMockRequestEvent(overrides: Partial<RequestEvent> = {}): RequestEvent {
    return {
      params: { id: mockTenantId, appointmentId: mockAppointmentId },
      request: {
        json: vi.fn().mockResolvedValue({ clientEmail: "test@example.com", clientLanguage: "de" }),
      } as any,
      ...overrides,
    } as RequestEvent;
  }

  it("should deny appointment", async () => {
    mockAppointmentService.denyAppointment.mockResolvedValue(true);
    const event = createMockRequestEvent();
    const response = await POST(event);
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockAppointmentService.denyAppointment).toHaveBeenCalledWith(
      mockAppointmentId,
      "test@example.com",
      "de",
    );
  });

  it("should return 400 if appointmentId is missing", async () => {
    const event = createMockRequestEvent({ params: { id: mockTenantId } });
    const response = await POST(event);
    const data = await response.json();
    expect(response.status).toBe(422);
  });

  it("should handle service errors", async () => {
    mockAppointmentService.denyAppointment.mockRejectedValue(new Error("fail"));
    const event = createMockRequestEvent();
    const response = await POST(event);
    expect(response.status).toBe(500);
  });
});
