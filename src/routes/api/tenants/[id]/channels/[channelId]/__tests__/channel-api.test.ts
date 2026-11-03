/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE, GET, PUT } from "../+server";
import { AppointmentService } from "$lib/server/services/appointment-service";
import { ChannelService } from "$lib/server/services/channel-service";
import { checkPermission } from "$lib/server/utils/permissions";
import {
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ValidationError,
} from "$lib/server/utils/errors";

vi.mock("$lib/server/services/appointment-service", () => ({
  AppointmentService: {
    forTenant: vi.fn(),
  },
}));

vi.mock("$lib/server/services/channel-service", () => ({
  ChannelService: {
    forTenant: vi.fn(),
  },
}));

vi.mock("$lib/server/utils/permissions", () => ({
  checkPermission: vi.fn(),
}));

vi.mock("$lib/server/openapi", () => ({
  registerOpenAPIRoute: vi.fn(),
}));

vi.mock("$lib/logger", () => ({
  default: {
    setContext: vi.fn(() => ({
      debug: vi.fn(),
      error: vi.fn(),
    })),
  },
}));

const tenantId = "550e8400-e29b-41d4-a716-446655440000";
const channelId = "550e8400-e29b-41d4-a716-446655440001";
const mockChannel = {
  id: channelId,
  names: { en: "Support" },
  agents: [],
  slotTemplates: [],
};
const updateBody = { names: { en: "Updated support" } };
const mockGetChannelById = vi.fn();
const mockUpdateChannel = vi.fn();
const mockDeleteChannel = vi.fn();
const mockGetAppointmentsForChannel = vi.fn();

const createEvent = (
  options: {
    id?: string;
    channelId?: string;
    body?: unknown;
    jsonError?: Error;
  } = {},
) => ({
  params: {
    id: Object.hasOwn(options, "id") ? options.id : tenantId,
    channelId: Object.hasOwn(options, "channelId") ? options.channelId : channelId,
  },
  locals: { user: { id: "user-123" } },
  request: {
    json: options.jsonError
      ? vi.fn().mockRejectedValue(options.jsonError)
      : vi.fn().mockResolvedValue(options.body),
  },
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(checkPermission).mockImplementation(() => undefined);
});

describe("GET /api/tenants/[id]/channels/[channelId]", () => {
  beforeEach(() => {
    vi.mocked(ChannelService.forTenant).mockResolvedValue({
      getChannelById: mockGetChannelById,
    } as any);
    mockGetChannelById.mockResolvedValue(mockChannel);
  });

  it("returns the requested channel", async () => {
    const response = await GET(createEvent() as any);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ channel: mockChannel });
    expect(checkPermission).toHaveBeenCalledWith(expect.anything(), tenantId, true);
    expect(ChannelService.forTenant).toHaveBeenCalledWith(tenantId);
    expect(mockGetChannelById).toHaveBeenCalledWith(channelId);
  });

  it.each([{ id: undefined }, { channelId: undefined }])(
    "returns a validation error when a route ID is missing",
    async (params) => {
      const response = await GET(createEvent(params) as any);

      expect(response.status).toBe(422);
      expect(checkPermission).not.toHaveBeenCalled();
      expect(ChannelService.forTenant).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["authentication", new AuthenticationError("Authentication required"), 401],
    ["authorization", new AuthorizationError("Insufficient permissions"), 403],
  ])("returns the %s error from the permission check", async (_label, error, status) => {
    vi.mocked(checkPermission).mockImplementationOnce(() => {
      throw error;
    });

    const response = await GET(createEvent() as any);

    expect(response.status).toBe(status);
    await expect(response.json()).resolves.toMatchObject({ error: error.message });
    expect(ChannelService.forTenant).not.toHaveBeenCalled();
  });

  it("returns not found when the channel does not exist", async () => {
    mockGetChannelById.mockResolvedValueOnce(null);

    const response = await GET(createEvent() as any);

    expect(response.status).toBe(404);
    expect(mockGetChannelById).toHaveBeenCalledWith(channelId);
  });

  it("passes through backend errors from the channel service", async () => {
    mockGetChannelById.mockRejectedValueOnce(new NotFoundError("Channel unavailable"));

    const response = await GET(createEvent() as any);

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ error: "Channel unavailable" });
  });

  it("returns an internal error when retrieving the channel fails unexpectedly", async () => {
    mockGetChannelById.mockRejectedValueOnce(new Error("Database failure"));

    const response = await GET(createEvent() as any);

    expect(response.status).toBe(500);
    expect((await response.json()).error).not.toContain("Database failure");
  });
});

describe("PUT /api/tenants/[id]/channels/[channelId]", () => {
  beforeEach(() => {
    vi.mocked(ChannelService.forTenant).mockResolvedValue({
      updateChannel: mockUpdateChannel,
    } as any);
    mockUpdateChannel.mockResolvedValue(mockChannel);
  });

  it("updates the channel and returns it", async () => {
    const response = await PUT(createEvent({ body: updateBody }) as any);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      message: "Channel updated successfully",
      channel: mockChannel,
    });
    expect(checkPermission).toHaveBeenCalledWith(expect.anything(), tenantId, true);
    expect(ChannelService.forTenant).toHaveBeenCalledWith(tenantId);
    expect(mockUpdateChannel).toHaveBeenCalledWith(channelId, updateBody);
  });

  it.each([{ id: undefined }, { channelId: undefined }])(
    "returns a validation error when a route ID is missing",
    async (params) => {
      const response = await PUT(createEvent({ ...params, body: updateBody }) as any);

      expect(response.status).toBe(422);
      expect(checkPermission).not.toHaveBeenCalled();
      expect(ChannelService.forTenant).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["authentication", new AuthenticationError("Authentication required"), 401],
    ["authorization", new AuthorizationError("Insufficient permissions"), 403],
  ])("returns the %s error from the permission check", async (_label, error, status) => {
    vi.mocked(checkPermission).mockImplementationOnce(() => {
      throw error;
    });

    const response = await PUT(createEvent({ body: updateBody }) as any);

    expect(response.status).toBe(status);
    await expect(response.json()).resolves.toMatchObject({ error: error.message });
    expect(ChannelService.forTenant).not.toHaveBeenCalled();
  });

  it("passes validation errors from the channel service through", async () => {
    mockUpdateChannel.mockRejectedValueOnce(new ValidationError("Invalid channel data"));

    const response = await PUT(createEvent({ body: updateBody }) as any);

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({ error: "Invalid channel data" });
  });

  it("returns an internal error for malformed JSON", async () => {
    const response = await PUT(
      createEvent({ jsonError: new SyntaxError("Unexpected token") }) as any,
    );

    expect(response.status).toBe(500);
    expect((await response.json()).error).not.toContain("Unexpected token");
    expect(ChannelService.forTenant).not.toHaveBeenCalled();
  });

  it("returns an internal error when updating the channel fails unexpectedly", async () => {
    mockUpdateChannel.mockRejectedValueOnce(new Error("Database failure"));

    const response = await PUT(createEvent({ body: updateBody }) as any);

    expect(response.status).toBe(500);
    expect((await response.json()).error).not.toContain("Database failure");
  });
});

describe("DELETE /api/tenants/[id]/channels/[channelId]", () => {
  beforeEach(() => {
    vi.mocked(AppointmentService.forTenant).mockResolvedValue({
      getAppointmentsForChannel: mockGetAppointmentsForChannel,
    } as any);
    vi.mocked(ChannelService.forTenant).mockResolvedValue({
      deleteChannel: mockDeleteChannel,
    } as any);
    mockGetAppointmentsForChannel.mockResolvedValue([]);
    mockDeleteChannel.mockResolvedValue(true);
  });

  it("deletes the channel when there are no open appointments", async () => {
    const response = await DELETE(createEvent() as any);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ message: "Channel deleted successfully" });
    expect(checkPermission).toHaveBeenCalledWith(expect.anything(), tenantId, true);
    expect(AppointmentService.forTenant).toHaveBeenCalledWith(tenantId);
    expect(mockGetAppointmentsForChannel).toHaveBeenCalledWith(channelId, expect.any(Date));
    expect(ChannelService.forTenant).toHaveBeenCalledWith(tenantId);
    expect(mockDeleteChannel).toHaveBeenCalledWith(channelId);
  });

  it.each([{ id: undefined }, { channelId: undefined }])(
    "returns a validation error when a route ID is missing",
    async (params) => {
      const response = await DELETE(createEvent(params) as any);

      expect(response.status).toBe(422);
      expect(checkPermission).not.toHaveBeenCalled();
      expect(AppointmentService.forTenant).not.toHaveBeenCalled();
      expect(ChannelService.forTenant).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["authentication", new AuthenticationError("Authentication required"), 401],
    ["authorization", new AuthorizationError("Insufficient permissions"), 403],
  ])("returns the %s error from the permission check", async (_label, error, status) => {
    vi.mocked(checkPermission).mockImplementationOnce(() => {
      throw error;
    });

    const response = await DELETE(createEvent() as any);

    expect(response.status).toBe(status);
    await expect(response.json()).resolves.toMatchObject({ error: error.message });
    expect(AppointmentService.forTenant).not.toHaveBeenCalled();
  });

  it("does not delete a channel that has open appointments", async () => {
    mockGetAppointmentsForChannel.mockResolvedValueOnce([{ id: "appointment-123" }]);

    const response = await DELETE(createEvent() as any);

    expect(response.status).toBe(409);
    expect(ChannelService.forTenant).not.toHaveBeenCalled();
    expect(mockDeleteChannel).not.toHaveBeenCalled();
  });

  it("returns not found when the channel does not exist", async () => {
    mockDeleteChannel.mockResolvedValueOnce(false);

    const response = await DELETE(createEvent() as any);

    expect(response.status).toBe(404);
    expect(mockDeleteChannel).toHaveBeenCalledWith(channelId);
  });

  it("returns an internal error when checking appointments fails unexpectedly", async () => {
    mockGetAppointmentsForChannel.mockRejectedValueOnce(new Error("Database failure"));

    const response = await DELETE(createEvent() as any);

    expect(response.status).toBe(500);
    expect((await response.json()).error).not.toContain("Database failure");
    expect(ChannelService.forTenant).not.toHaveBeenCalled();
  });

  it("returns an internal error when deleting the channel fails unexpectedly", async () => {
    mockDeleteChannel.mockRejectedValueOnce(new Error("Database failure"));

    const response = await DELETE(createEvent() as any);

    expect(response.status).toBe(500);
    expect((await response.json()).error).not.toContain("Database failure");
  });
});
