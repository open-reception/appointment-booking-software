/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "../+server";
import { ChannelService } from "$lib/server/services/channel-service";
import { checkPermission } from "$lib/server/utils/permissions";
import {
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ValidationError,
} from "$lib/server/utils/errors";

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
const mockChannels = [mockChannel];
const mockCreateChannel = vi.fn();
const mockGetAllChannels = vi.fn();

const createEvent = (
  options: {
    id?: string;
    body?: unknown;
    jsonError?: Error;
  } = {},
) => ({
  params: { id: Object.hasOwn(options, "id") ? options.id : tenantId },
  locals: { user: { id: "user-123" } },
  request: {
    json: options.jsonError
      ? vi.fn().mockRejectedValue(options.jsonError)
      : vi.fn().mockResolvedValue(options.body),
  },
});

describe("GET /api/tenants/[id]/channels", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(checkPermission).mockImplementation(() => undefined);
    vi.mocked(ChannelService.forTenant).mockResolvedValue({
      getAllChannels: mockGetAllChannels,
    } as any);
    mockGetAllChannels.mockResolvedValue(mockChannels);
  });

  it("returns all channels for the tenant", async () => {
    const response = await GET(createEvent() as any);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ channels: mockChannels });
    expect(checkPermission).toHaveBeenCalledWith(expect.anything(), tenantId);
    expect(ChannelService.forTenant).toHaveBeenCalledWith(tenantId);
    expect(mockGetAllChannels).toHaveBeenCalledOnce();
  });

  it("returns an empty channel list when the tenant has no channels", async () => {
    mockGetAllChannels.mockResolvedValueOnce([]);

    const response = await GET(createEvent() as any);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ channels: [] });
  });

  it("returns a validation error when the tenant ID is missing", async () => {
    const response = await GET(createEvent({ id: undefined }) as any);

    expect(response.status).toBe(422);
    expect(checkPermission).not.toHaveBeenCalled();
    expect(ChannelService.forTenant).not.toHaveBeenCalled();
  });

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

  it("passes through backend errors from the channel service", async () => {
    vi.mocked(ChannelService.forTenant).mockRejectedValueOnce(
      new NotFoundError("Tenant not found"),
    );

    const response = await GET(createEvent() as any);

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ error: "Tenant not found" });
  });

  it("returns an internal error when retrieving channels fails unexpectedly", async () => {
    mockGetAllChannels.mockRejectedValueOnce(new Error("Database failure"));

    const response = await GET(createEvent() as any);

    expect(response.status).toBe(500);
    const result = await response.json();
    expect(result).toHaveProperty("error");
    expect(result.error).not.toContain("Database failure");
  });
});

describe("POST /api/tenants/[id]/channels", () => {
  const requestBody = {
    names: { en: "Support" },
    languages: ["en"],
    agentIds: [],
    staffIds: [],
    slotTemplates: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(checkPermission).mockImplementation(() => undefined);
    vi.mocked(ChannelService.forTenant).mockResolvedValue({
      createChannel: mockCreateChannel,
    } as any);
    mockCreateChannel.mockResolvedValue(mockChannel);
  });

  it("creates a channel and returns it with status 201", async () => {
    const response = await POST(createEvent({ body: requestBody }) as any);

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      message: "Channel created successfully",
      channel: mockChannel,
    });
    expect(checkPermission).toHaveBeenCalledWith(expect.anything(), tenantId, true);
    expect(ChannelService.forTenant).toHaveBeenCalledWith(tenantId);
    expect(mockCreateChannel).toHaveBeenCalledWith(requestBody);
  });

  it("returns a validation error when the tenant ID is missing", async () => {
    const response = await POST(createEvent({ id: undefined, body: requestBody }) as any);

    expect(response.status).toBe(422);
    expect(checkPermission).not.toHaveBeenCalled();
    expect(ChannelService.forTenant).not.toHaveBeenCalled();
  });

  it.each([
    ["authentication", new AuthenticationError("Authentication required"), 401],
    ["authorization", new AuthorizationError("Insufficient permissions"), 403],
  ])("returns the %s error from the permission check", async (_label, error, status) => {
    vi.mocked(checkPermission).mockImplementationOnce(() => {
      throw error;
    });

    const response = await POST(createEvent({ body: requestBody }) as any);

    expect(response.status).toBe(status);
    await expect(response.json()).resolves.toMatchObject({ error: error.message });
    expect(ChannelService.forTenant).not.toHaveBeenCalled();
  });

  it("passes validation errors from the channel service through", async () => {
    vi.mocked(ChannelService.forTenant).mockResolvedValueOnce({
      createChannel: vi.fn().mockRejectedValue(new ValidationError("Invalid channel data")),
    } as any);

    const response = await POST(createEvent({ body: requestBody }) as any);

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({ error: "Invalid channel data" });
  });

  it("returns an internal error for malformed JSON", async () => {
    const response = await POST(
      createEvent({ jsonError: new SyntaxError("Unexpected token") }) as any,
    );

    expect(response.status).toBe(500);
    expect((await response.json()).error).not.toContain("Unexpected token");
    expect(ChannelService.forTenant).not.toHaveBeenCalled();
  });

  it("returns an internal error when channel creation fails unexpectedly", async () => {
    mockCreateChannel.mockRejectedValueOnce(new Error("Database failure"));

    const response = await POST(createEvent({ body: requestBody }) as any);

    expect(response.status).toBe(500);
    expect((await response.json()).error).not.toContain("Database failure");
  });
});
