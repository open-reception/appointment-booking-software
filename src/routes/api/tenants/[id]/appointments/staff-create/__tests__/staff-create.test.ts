/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "../+server";

// Mock dependencies
vi.mock("$lib/server/services/appointment-service", () => ({
  AppointmentService: {
    forTenant: vi.fn(),
  },
}));

vi.mock("$lib/server/services/client-pin-reset-service", () => ({
  ClientPinResetService: {
    forTenant: vi.fn(),
  },
}));

vi.mock("$lib/server/utils/permissions", () => ({
  checkPermission: vi.fn(),
}));

import { AppointmentService } from "$lib/server/services/appointment-service";
import { ClientPinResetService } from "$lib/server/services/client-pin-reset-service";
import { checkPermission } from "$lib/server/utils/permissions";

describe("POST /api/tenants/[id]/appointments/staff-create", () => {
  const tenantId = "12345678-1234-4234-8234-123456789012";
  const emailHash = "2c26b46b68ffc68ff99b453c1d30413413422d706483bfa0f98a5e886266e7ae";

  const mockAppointmentService = {
    getClientTunnels: vi.fn(),
    createNewClientWithAppointment: vi.fn(),
    addAppointmentToTunnel: vi.fn(),
    sendAppointmentNotification: vi.fn(),
  };

  const mockPinResetService = {
    createResetToken: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(checkPermission).mockResolvedValue(undefined);
    vi.mocked(AppointmentService.forTenant).mockResolvedValue(mockAppointmentService as any);
    vi.mocked(ClientPinResetService.forTenant).mockResolvedValue(mockPinResetService as any);
  });

  describe("New Client with Email", () => {
    it("should create appointment for new client with email", async () => {
      // Mock no existing tunnels
      mockAppointmentService.getClientTunnels.mockResolvedValue([]);

      // Mock appointment creation
      mockAppointmentService.createNewClientWithAppointment.mockResolvedValue({
        id: "appointment-123",
        appointmentDate: "2026-01-15T14:00:00.000Z",
        status: "NEW",
        requiresConfirmation: true,
      });

      // Mock PIN reset token creation
      mockPinResetService.createResetToken.mockResolvedValue("reset-token-123");

      const request = new Request("http://localhost/api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientEmail: "test@example.com",
          emailHash,
          appointmentDate: "2026-01-15T14:00:00.000Z",
          duration: 30,
          channelId: "channel-123",
          agentId: "agent-123",
          tunnelId: "tunnel-123",
          clientPublicKey: "public-key",
          privateKeyShare: "private-key-share",
          clientEncryptedTunnelKey: "encrypted-tunnel-key",
          staffKeyShares: [
            {
              userId: "staff-123",
              encryptedTunnelKey: "encrypted-for-staff",
            },
          ],
          encryptedAppointment: {
            encryptedPayload: "encrypted-payload",
            iv: "iv",
            authTag: "auth-tag",
          },
          sendEmail: true,
        }),
      });

      const result = await POST({
        params: { id: tenantId },
        request,
        locals: { user: { id: "staff-123", role: "STAFF" } } as any,
      } as any);

      expect(result.status).toBe(200);
      const data = await result.json();

      expect(data.id).toBe("appointment-123");
      expect(data.isNewClient).toBe(true);
      expect(data.pinResetToken).toBe("reset-token-123");
      expect(mockAppointmentService.createNewClientWithAppointment).toHaveBeenCalledWith({
        tunnelId: "tunnel-123",
        channelId: "channel-123",
        agentId: "agent-123",
        appointmentDate: "2026-01-15T14:00:00.000Z",
        duration: 30,
        emailHash,
        clientEmail: "test@example.com",
        clientLanguage: "de",
        clientPublicKey: "public-key",
        privateKeyShare: "private-key-share",
        encryptedAppointment: {
          encryptedPayload: "encrypted-payload",
          iv: "iv",
          authTag: "auth-tag",
        },
        staffKeyShares: [
          {
            userId: "staff-123",
            encryptedTunnelKey: "encrypted-for-staff",
          },
        ],
        clientEncryptedTunnelKey: "encrypted-tunnel-key",
      });
      expect(mockPinResetService.createResetToken).toHaveBeenCalledWith(emailHash, 60);
    });
  });

  describe("New Client without Email", () => {
    it("should create appointment for new client without email", async () => {
      mockAppointmentService.getClientTunnels.mockResolvedValue([]);

      mockAppointmentService.createNewClientWithAppointment.mockResolvedValue({
        id: "appointment-456",
        appointmentDate: "2026-01-15T14:00:00.000Z",
        status: "CONFIRMED",
        requiresConfirmation: false,
      });

      const request = new Request("http://localhost/api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hasNoEmail: true,
          emailHash: "unique-hash-for-no-email",
          appointmentDate: "2026-01-15T14:00:00.000Z",
          duration: 30,
          channelId: "channel-123",
          agentId: "agent-123",
          tunnelId: "tunnel-456",
          clientPublicKey: "public-key",
          privateKeyShare: "private-key-share",
          clientEncryptedTunnelKey: "encrypted-tunnel-key",
          staffKeyShares: [
            {
              userId: "staff-123",
              encryptedTunnelKey: "encrypted-for-staff",
            },
          ],
          encryptedAppointment: {
            encryptedPayload: "encrypted-payload",
            iv: "iv",
            authTag: "auth-tag",
          },
          sendEmail: false,
        }),
      });

      const result = await POST({
        params: { id: tenantId },
        request,
        locals: { user: { id: "staff-123", role: "STAFF" } } as any,
      } as any);

      expect(result.status).toBe(200);
      const data = await result.json();

      expect(data.id).toBe("appointment-456");
      expect(data.isNewClient).toBe(true);
      expect(data.pinResetToken).toBeUndefined();
      expect(mockPinResetService.createResetToken).not.toHaveBeenCalled();
    });
  });

  describe("Existing Client", () => {
    it("should add appointment to existing client tunnel", async () => {
      // Mock existing tunnel
      mockAppointmentService.getClientTunnels.mockResolvedValue([
        {
          id: "tunnel-789",
          emailHash,
          clientPublicKey: "existing-public-key",
        },
      ]);

      mockAppointmentService.addAppointmentToTunnel.mockResolvedValue({
        id: "appointment-789",
        appointmentDate: "2026-01-15T14:00:00.000Z",
        status: "CONFIRMED",
        requiresConfirmation: false,
      });

      const request = new Request("http://localhost/api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientEmail: "existing@example.com",
          emailHash,
          appointmentDate: "2026-01-15T14:00:00.000Z",
          duration: 30,
          channelId: "channel-123",
          agentId: "agent-123",
          encryptedAppointment: {
            encryptedPayload: "encrypted-payload",
            iv: "iv",
            authTag: "auth-tag",
          },
          sendEmail: true,
        }),
      });

      const result = await POST({
        params: { id: tenantId },
        request,
        locals: { user: { id: "staff-123", role: "STAFF" } } as any,
      } as any);

      expect(result.status).toBe(200);
      const data = await result.json();

      expect(data.id).toBe("appointment-789");
      expect(data.isNewClient).toBe(false);
      expect(data.pinResetToken).toBeUndefined();
      expect(mockAppointmentService.addAppointmentToTunnel).toHaveBeenCalledWith({
        emailHash,
        tunnelId: "tunnel-789",
        channelId: "channel-123",
        agentId: "agent-123",
        appointmentDate: "2026-01-15T14:00:00.000Z",
        duration: 30,
        clientEmail: "existing@example.com",
        clientLanguage: "de",
        encryptedAppointment: {
          encryptedPayload: "encrypted-payload",
          iv: "iv",
          authTag: "auth-tag",
        },
      });
    });
  });

  describe("Error Cases", () => {
    it("should return 400 for invalid request data", async () => {
      const request = new Request("http://localhost/api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // Missing required fields
          emailHash,
        }),
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

    it("should return 400 for new client with missing crypto data", async () => {
      mockAppointmentService.getClientTunnels.mockResolvedValue([]);

      const request = new Request("http://localhost/api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientEmail: "test@example.com",
          emailHash,
          appointmentDate: "2026-01-15T14:00:00.000Z",
          duration: 30,
          channelId: "channel-123",
          agentId: "agent-123",
          // Missing tunnelId, clientPublicKey, etc.
          encryptedAppointment: {
            encryptedPayload: "encrypted-payload",
            iv: "iv",
            authTag: "auth-tag",
          },
        }),
      });

      const result = await POST({
        params: { id: tenantId },
        request,
        locals: { user: { id: "staff-123", role: "STAFF" } } as any,
      } as any);

      expect(result.status).toBe(400);
      const data = await result.json();
      expect(data.error).toContain("Missing required crypto data");
    });

    it("should check permissions", async () => {
      vi.mocked(checkPermission).mockRejectedValue(new Error("Permission denied"));

      const request = new Request("http://localhost/api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientEmail: "test@example.com",
          emailHash,
          appointmentDate: "2026-01-15T14:00:00.000Z",
          duration: 30,
          channelId: "channel-123",
          agentId: "agent-123",
          encryptedAppointment: {
            encryptedPayload: "encrypted-payload",
            iv: "iv",
            authTag: "auth-tag",
          },
        }),
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

    it("should return 400 for neither clientEmail nor hasNoEmail provided", async () => {
      const request = new Request("http://localhost/api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // Neither clientEmail nor hasNoEmail
          emailHash,
          appointmentDate: "2026-01-15T14:00:00.000Z",
          duration: 30,
          channelId: "channel-123",
          agentId: "agent-123",
          encryptedAppointment: {
            encryptedPayload: "encrypted-payload",
            iv: "iv",
            authTag: "auth-tag",
          },
        }),
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

    it("should return 400 when sendEmail is true but clientEmail is missing", async () => {
      mockAppointmentService.getClientTunnels.mockResolvedValue([]);

      const request = new Request("http://localhost/api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emailHash,
          appointmentDate: "2026-01-15T14:00:00.000Z",
          duration: 30,
          channelId: "channel-123",
          agentId: "agent-123",
          tunnelId: "tunnel-123",
          clientPublicKey: "public-key",
          privateKeyShare: "private-key-share",
          clientEncryptedTunnelKey: "encrypted-tunnel-key",
          staffKeyShares: [
            {
              userId: "staff-123",
              encryptedTunnelKey: "encrypted-for-staff",
            },
          ],
          encryptedAppointment: {
            encryptedPayload: "encrypted-payload",
            iv: "iv",
            authTag: "auth-tag",
          },
          sendEmail: true, // Email required but not provided
        }),
      });

      const result = await POST({
        params: { id: tenantId },
        request,
        locals: { user: { id: "staff-123", role: "STAFF" } } as any,
      } as any);

      expect(result.status).toBe(400);
      const data = await result.json();
      expect(data.error).toContain("clientEmail is required when sendEmail is true");
    });
  });

  describe("Email Sending", () => {
    it("should send email for new client when sendEmail is true", async () => {
      mockAppointmentService.getClientTunnels.mockResolvedValue([]);
      mockAppointmentService.createNewClientWithAppointment.mockResolvedValue({
        id: "appointment-123",
        appointmentDate: "2026-01-15T14:00:00.000Z",
        status: "NEW",
        requiresConfirmation: true,
      });
      mockPinResetService.createResetToken.mockResolvedValue("reset-token-123");
      mockAppointmentService.sendAppointmentNotification.mockResolvedValue(undefined);

      const request = new Request("http://localhost/api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientEmail: "test@example.com",
          emailHash,
          appointmentDate: "2026-01-15T14:00:00.000Z",
          duration: 30,
          channelId: "channel-123",
          agentId: "agent-123",
          tunnelId: "tunnel-123",
          clientPublicKey: "public-key",
          privateKeyShare: "private-key-share",
          clientEncryptedTunnelKey: "encrypted-tunnel-key",
          staffKeyShares: [
            {
              userId: "staff-123",
              encryptedTunnelKey: "encrypted-for-staff",
            },
          ],
          encryptedAppointment: {
            encryptedPayload: "encrypted-payload",
            iv: "iv",
            authTag: "auth-tag",
          },
          sendEmail: true,
        }),
      });

      await POST({
        params: { id: tenantId },
        request,
        locals: { user: { id: "staff-123", role: "STAFF" } } as any,
      } as any);

      // Email sending is async, so we just verify it was called
      expect(mockAppointmentService.sendAppointmentNotification).toHaveBeenCalledWith(
        "appointment-123",
        "channel-123",
        "test@example.com",
        "de",
        true,
      );
    });

    it("should not send email when sendEmail is false", async () => {
      mockAppointmentService.getClientTunnels.mockResolvedValue([]);
      mockAppointmentService.createNewClientWithAppointment.mockResolvedValue({
        id: "appointment-123",
        appointmentDate: "2026-01-15T14:00:00.000Z",
        status: "NEW",
        requiresConfirmation: true,
      });

      const request = new Request("http://localhost/api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientEmail: "test@example.com",
          emailHash,
          appointmentDate: "2026-01-15T14:00:00.000Z",
          duration: 30,
          channelId: "channel-123",
          agentId: "agent-123",
          tunnelId: "tunnel-123",
          clientPublicKey: "public-key",
          privateKeyShare: "private-key-share",
          clientEncryptedTunnelKey: "encrypted-tunnel-key",
          staffKeyShares: [
            {
              userId: "staff-123",
              encryptedTunnelKey: "encrypted-for-staff",
            },
          ],
          encryptedAppointment: {
            encryptedPayload: "encrypted-payload",
            iv: "iv",
            authTag: "auth-tag",
          },
          sendEmail: false,
        }),
      });

      await POST({
        params: { id: tenantId },
        request,
        locals: { user: { id: "staff-123", role: "STAFF" } } as any,
      } as any);

      expect(mockAppointmentService.sendAppointmentNotification).not.toHaveBeenCalled();
    });
  });
});
