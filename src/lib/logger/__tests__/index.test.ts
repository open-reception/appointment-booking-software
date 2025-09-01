/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock $app/environment before importing the logger
vi.mock("$app/environment", () => ({
  browser: true,
}));

// Mock global objects that exist in browser
Object.defineProperty(global, "navigator", {
  value: {
    userAgent: "Test Browser/1.0",
  },
  writable: true,
});

Object.defineProperty(global, "window", {
  value: {
    location: {
      href: "https://test.example.com/page",
    },
  },
  writable: true,
});

// Mock console methods
const mockConsole = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("UniversalLogger - Client Side", () => {
  let logger: any;
  let createLogger: any;

  beforeEach(async () => {
    // Clear all mocks
    vi.clearAllMocks();

    // Mock console methods
    vi.spyOn(console, "debug").mockImplementation(mockConsole.debug);
    vi.spyOn(console, "info").mockImplementation(mockConsole.info);
    vi.spyOn(console, "warn").mockImplementation(mockConsole.warn);
    vi.spyOn(console, "error").mockImplementation(mockConsole.error);

    // Dynamic import after mocks are set up
    const loggerModule = await import("../index");
    logger = loggerModule.logger;
    createLogger = loggerModule.createLogger;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Context Management", () => {
    it("should set and use context correctly", () => {
      const contextLogger = createLogger("TestContext");
      contextLogger.info("Test message");

      expect(mockConsole.info).toHaveBeenCalledWith("ℹ️ [TestContext] Test message", {});
    });

    it("should work without context", () => {
      logger.info("Test message");

      expect(mockConsole.info).toHaveBeenCalledWith("ℹ️ Test message", {});
    });

    it("should return logger instance when setting context", () => {
      const result = logger.setContext("TestContext");
      expect(result).toBe(logger);
    });
  });

  describe("Logging Methods", () => {
    it("should log debug messages with correct format", () => {
      const testLogger = createLogger("Debug");
      const meta = { extra: "data" };

      testLogger.debug("Debug message", meta);

      expect(mockConsole.debug).toHaveBeenCalledWith("🐛 [Debug] Debug message", meta);
    });

    it("should log info messages with correct format", () => {
      const testLogger = createLogger("Info");
      const meta = { userId: 123 };

      testLogger.info("Info message", meta);

      expect(mockConsole.info).toHaveBeenCalledWith("ℹ️ [Info] Info message", meta);
    });

    it("should log warn messages with correct format", () => {
      const testLogger = createLogger("Warn");
      const meta = { warning: "deprecated" };

      testLogger.warn("Warning message", meta);

      expect(mockConsole.warn).toHaveBeenCalledWith("⚠️ [Warn] Warning message", meta);
    });

    it("should log error messages with correct format", () => {
      const testLogger = createLogger("Error");
      const meta = { error: "failed" };

      testLogger.error("Error message", meta);

      expect(mockConsole.error).toHaveBeenCalledWith("❌ [Error] Error message", meta);
    });

    it("should handle empty meta objects", async () => {
      // Create a fresh logger without context
      const { UniversalLogger } = await import("../index");
      const freshLogger = new UniversalLogger();
      freshLogger.info("Message without meta");

      expect(mockConsole.info).toHaveBeenCalledWith("ℹ️ Message without meta", {});
    });
  });

  describe("Client Error Forwarding", () => {
    it("should send error to server when logging error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      const testLogger = createLogger("ErrorTest");
      const meta = { errorCode: 500 };

      testLogger.error("Server error", meta);

      // Wait for async operation
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/log",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: expect.stringContaining('"level":"error"'),
        }),
      );

      // Verify the sent data contains expected properties
      const sentData = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(sentData.level).toBe("error");
      expect(sentData.message).toBe("Server error");
      expect(sentData.meta.context).toBe("ErrorTest");
      expect(sentData.meta.url).toBe("https://test.example.com/page");
      expect(sentData.meta.userAgent).toBe("Test Browser/1.0");
      expect(sentData.meta.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it("should handle fetch errors gracefully", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const testLogger = createLogger("ErrorTest");
      testLogger.error("Test error");

      // Wait for async operation
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockConsole.error).toHaveBeenCalledWith(
        "Failed to send error to server:",
        expect.any(Error),
      );
    });

    it("should not send non-error logs to server", () => {
      logger.info("Info message");
      logger.warn("Warning message");
      logger.debug("Debug message");

      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe("Request Logging", () => {
    it("should log successful requests as info", async () => {
      const mockRequest = {
        method: "GET",
        url: "https://api.example.com/users",
      } as Request;

      // Create a fresh logger without context
      const { UniversalLogger } = await import("../index");
      const freshLogger = new UniversalLogger();
      freshLogger.logRequest(mockRequest, 150, 200);

      expect(mockConsole.info).toHaveBeenCalledWith(
        "ℹ️ GET https://api.example.com/users - 200 (150ms)",
        {
          method: "GET",
          url: "https://api.example.com/users",
          statusCode: 200,
          responseTime: 150,
        },
      );
    });

    it("should log client errors (4xx) as errors", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      const mockRequest = {
        method: "POST",
        url: "https://api.example.com/users",
      } as Request;

      // Create a fresh logger without context
      const { UniversalLogger } = await import("../index");
      const freshLogger = new UniversalLogger();
      freshLogger.logRequest(mockRequest, 200, 404);

      expect(mockConsole.error).toHaveBeenCalledWith(
        "❌ POST https://api.example.com/users - 404 (200ms)",
        {
          method: "POST",
          url: "https://api.example.com/users",
          statusCode: 404,
          responseTime: 200,
        },
      );

      // Should also send to server since it's an error
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(mockFetch).toHaveBeenCalled();
    });

    it("should log server errors (5xx) as errors", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      const mockRequest = {
        method: "GET",
        url: "https://api.example.com/data",
      } as Request;

      // Create a fresh logger without context
      const { UniversalLogger } = await import("../index");
      const freshLogger = new UniversalLogger();
      freshLogger.logRequest(mockRequest, 1000, 500);

      expect(mockConsole.error).toHaveBeenCalledWith(
        "❌ GET https://api.example.com/data - 500 (1000ms)",
        {
          method: "GET",
          url: "https://api.example.com/data",
          statusCode: 500,
          responseTime: 1000,
        },
      );

      // Should also send to server since it's an error
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(mockFetch).toHaveBeenCalled();
    });
  });

  describe("Factory Function", () => {
    it("should create new logger instances with context", () => {
      const logger1 = createLogger("Context1");
      const logger2 = createLogger("Context2");

      logger1.info("Message 1");
      logger2.info("Message 2");

      expect(mockConsole.info).toHaveBeenNthCalledWith(1, "ℹ️ [Context1] Message 1", {});
      expect(mockConsole.info).toHaveBeenNthCalledWith(2, "ℹ️ [Context2] Message 2", {});
    });

    it("should create independent logger instances", () => {
      const logger1 = createLogger("Context1");
      const logger2 = createLogger("Context2");

      // Modify one logger's context
      logger1.setContext("ModifiedContext");

      logger1.info("Message 1");
      logger2.info("Message 2");

      expect(mockConsole.info).toHaveBeenNthCalledWith(1, "ℹ️ [ModifiedContext] Message 1", {});
      expect(mockConsole.info).toHaveBeenNthCalledWith(2, "ℹ️ [Context2] Message 2", {});
    });
  });
});
