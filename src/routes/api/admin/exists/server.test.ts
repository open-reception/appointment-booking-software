/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./+server";

// Mock dependencies
vi.mock("$lib/server/services/user-service", () => ({
  UserService: {
    adminExists: vi.fn(),
    getAdminCount: vi.fn(),
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

// Import after mocking
import { UserService } from "$lib/server/services/user-service";

describe("GET /api/admin/exists", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return admin exists status when admin exists", async () => {
    vi.mocked(UserService.adminExists).mockResolvedValue(true);
    vi.mocked(UserService.getAdminCount).mockResolvedValue(2);

    const response = await GET({} as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      exists: true,
      count: 2,
    });
    expect(UserService.adminExists).toHaveBeenCalledOnce();
    expect(UserService.getAdminCount).toHaveBeenCalledOnce();
  });

  it("should return admin does not exist when no admin found", async () => {
    vi.mocked(UserService.adminExists).mockResolvedValue(false);
    vi.mocked(UserService.getAdminCount).mockResolvedValue(0);

    const response = await GET({} as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      exists: false,
      count: 0,
    });
    expect(UserService.adminExists).toHaveBeenCalledOnce();
    expect(UserService.getAdminCount).toHaveBeenCalledOnce();
  });

  it("should handle service errors", async () => {
    vi.mocked(UserService.adminExists).mockRejectedValue(new Error("Database error"));

    const response = await GET({} as any);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Internal server error");
    expect(UserService.adminExists).toHaveBeenCalledOnce();
    expect(UserService.getAdminCount).not.toHaveBeenCalled();
  });

  it("should handle getAdminCount error", async () => {
    vi.mocked(UserService.adminExists).mockResolvedValue(true);
    vi.mocked(UserService.getAdminCount).mockRejectedValue(new Error("Count error"));

    const response = await GET({} as any);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Internal server error");
    expect(UserService.adminExists).toHaveBeenCalledOnce();
    expect(UserService.getAdminCount).toHaveBeenCalledOnce();
  });
});
