import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { generateBaseUrl } from "../email-service";

// Mock NODE_ENV
const mockEnv = vi.hoisted(() => ({
  NODE_ENV: "development",
  DATABASE_URL: "postgresql://test:test@localhost:5432/test",
}));

vi.mock("$env/dynamic/private", () => ({
  env: mockEnv,
}));

describe("generateBaseUrl", () => {
  beforeEach(() => {
    // Reset NODE_ENV to development for each test
    mockEnv.NODE_ENV = "development";
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should return localhost with port", () => {
    const requestUrl = new URL("http://localhost:5173");
    const result = generateBaseUrl(requestUrl);
    expect(result).toBe("http://localhost:5173");
  });

  it("should return tenant domain", () => {
    const requestUrl = new URL("https://example.com");

    const result = generateBaseUrl(requestUrl);
    expect(result).toBe("https://example.com");
  });
});
