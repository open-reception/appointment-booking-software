/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock $app/environment for server environment
vi.mock("$app/environment", () => ({
  browser: false,
  dev: true,
}));

// Mock winston logger
const mockWinstonLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

// Mock winston module
vi.mock("../winston", () => ({
  default: mockWinstonLogger,
}));

describe("UniversalLogger - Server Side", () => {
  let logger: any;
  let createLogger: any;

  beforeEach(async () => {
    // Clear all mocks
    vi.clearAllMocks();

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
      const contextLogger = createLogger("ServerContext");
      contextLogger.info("Server message", { data: "test" });

      expect(mockWinstonLogger.info).toHaveBeenCalledWith({
        message: "[ServerContext] Server message",
        data: "test",
        source: "server",
        userAgent: undefined,
        timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
      });
    });

    it("should work without context", () => {
      logger.info("Server message without context");

      expect(mockWinstonLogger.info).toHaveBeenCalledWith({
        message: "Server message without context",
        source: "server",
        userAgent: undefined,
        timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
      });
    });

    it("should return logger instance when setting context", () => {
      const result = logger.setContext("TestContext");
      expect(result).toBe(logger);
    });
  });

  describe("Message Formatting", () => {
    it("should format messages with context prefix", () => {
      const testLogger = createLogger("API");
      testLogger.debug("Processing request", { requestId: "123" });

      expect(mockWinstonLogger.debug).toHaveBeenCalledWith({
        message: "[API] Processing request",
        requestId: "123",
        source: "server",
        userAgent: undefined,
        timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
      });
    });

    it("should format messages without context prefix when no context set", async () => {
      // Create a fresh logger without context
      const { UniversalLogger } = await import("../index");
      const freshLogger = new UniversalLogger();
      freshLogger.debug("Processing request", { requestId: "456" });

      expect(mockWinstonLogger.debug).toHaveBeenCalledWith({
        message: "Processing request",
        requestId: "456",
        source: "server",
        userAgent: undefined,
        timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
      });
    });

    it("should include source as server", () => {
      logger.info("Test message");

      expect(mockWinstonLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          source: "server",
        }),
      );
    });

    it("should set userAgent as undefined for server", () => {
      logger.info("Test message");

      expect(mockWinstonLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          userAgent: undefined,
        }),
      );
    });

    it("should add timestamp to all messages", () => {
      const beforeTime = Date.now();
      logger.info("Test message");
      const afterTime = Date.now();

      expect(mockWinstonLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
        }),
      );

      const loggedTimestamp = new Date(mockWinstonLogger.info.mock.calls[0][0].timestamp).getTime();
      expect(loggedTimestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(loggedTimestamp).toBeLessThanOrEqual(afterTime);
    });
  });

  describe("Logging Methods", () => {
    it("should call winston debug with formatted message", () => {
      const testLogger = createLogger("Debug");
      const meta = { debug: true, level: 1 };

      testLogger.debug("Debug message", meta);

      expect(mockWinstonLogger.debug).toHaveBeenCalledWith({
        message: "[Debug] Debug message",
        debug: true,
        level: 1,
        source: "server",
        userAgent: undefined,
        timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
      });
    });

    it("should call winston info with formatted message", () => {
      const testLogger = createLogger("Info");
      const meta = { userId: 123, action: "login" };

      testLogger.info("User logged in", meta);

      expect(mockWinstonLogger.info).toHaveBeenCalledWith({
        message: "[Info] User logged in",
        userId: 123,
        action: "login",
        source: "server",
        userAgent: undefined,
        timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
      });
    });

    it("should call winston warn with formatted message", () => {
      const testLogger = createLogger("Warn");
      const meta = { warning: "deprecated", api: "v1" };

      testLogger.warn("API deprecated", meta);

      expect(mockWinstonLogger.warn).toHaveBeenCalledWith({
        message: "[Warn] API deprecated",
        warning: "deprecated",
        api: "v1",
        source: "server",
        userAgent: undefined,
        timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
      });
    });

    it("should call winston error with formatted message", () => {
      const testLogger = createLogger("Error");
      const meta = { error: "database_connection", code: 500 };

      testLogger.error("Database connection failed", meta);

      expect(mockWinstonLogger.error).toHaveBeenCalledWith({
        message: "[Error] Database connection failed",
        error: "database_connection",
        code: 500,
        source: "server",
        userAgent: undefined,
        timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
      });
    });

    it("should handle empty meta objects", async () => {
      // Create a fresh logger without context
      const { UniversalLogger } = await import("../index");
      const freshLogger = new UniversalLogger();
      freshLogger.info("Message without meta");

      expect(mockWinstonLogger.info).toHaveBeenCalledWith({
        message: "Message without meta",
        source: "server",
        userAgent: undefined,
        timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
      });
    });

    it("should preserve existing meta properties", async () => {
      const meta = {
        source: "override-attempt",
        timestamp: "override-attempt",
        userAgent: "override-attempt",
        customProp: "should-be-preserved",
      };

      // Create a fresh logger without context
      const { UniversalLogger } = await import("../index");
      const freshLogger = new UniversalLogger();
      freshLogger.info("Test message", meta);

      expect(mockWinstonLogger.info).toHaveBeenCalledWith({
        message: "Test message",
        source: "server", // Should override
        timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/), // Should override
        userAgent: undefined, // Should override
        customProp: "should-be-preserved", // Should preserve
      });
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

      expect(mockWinstonLogger.info).toHaveBeenCalledWith({
        message: "GET https://api.example.com/users - 200 (150ms)",
        method: "GET",
        url: "https://api.example.com/users",
        statusCode: 200,
        responseTime: 150,
        source: "server",
        userAgent: undefined,
        timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
      });
    });

    it("should log client errors (4xx) as errors", async () => {
      const mockRequest = {
        method: "POST",
        url: "https://api.example.com/users",
      } as Request;

      // Create a fresh logger without context
      const { UniversalLogger } = await import("../index");
      const freshLogger = new UniversalLogger();
      freshLogger.logRequest(mockRequest, 200, 404);

      expect(mockWinstonLogger.error).toHaveBeenCalledWith({
        message: "POST https://api.example.com/users - 404 (200ms)",
        method: "POST",
        url: "https://api.example.com/users",
        statusCode: 404,
        responseTime: 200,
        source: "server",
        userAgent: undefined,
        timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
      });
    });

    it("should log server errors (5xx) as errors", async () => {
      const mockRequest = {
        method: "PUT",
        url: "https://api.example.com/data/123",
      } as Request;

      // Create a fresh logger without context
      const { UniversalLogger } = await import("../index");
      const freshLogger = new UniversalLogger();
      freshLogger.logRequest(mockRequest, 5000, 500);

      expect(mockWinstonLogger.error).toHaveBeenCalledWith({
        message: "PUT https://api.example.com/data/123 - 500 (5000ms)",
        method: "PUT",
        url: "https://api.example.com/data/123",
        statusCode: 500,
        responseTime: 5000,
        source: "server",
        userAgent: undefined,
        timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
      });
    });

    it("should handle edge case status codes correctly", async () => {
      const mockRequest = {
        method: "GET",
        url: "https://api.example.com/test",
      } as Request;

      // Create fresh loggers without context
      const { UniversalLogger } = await import("../index");
      const freshLogger1 = new UniversalLogger();
      const freshLogger2 = new UniversalLogger();

      // Test boundary cases
      freshLogger1.logRequest(mockRequest, 100, 399); // Should be info
      expect(mockWinstonLogger.info).toHaveBeenCalled();

      vi.clearAllMocks();

      freshLogger2.logRequest(mockRequest, 100, 400); // Should be error
      expect(mockWinstonLogger.error).toHaveBeenCalled();
    });
  });

  describe("Factory Function", () => {
    it("should create new logger instances with different contexts", () => {
      const logger1 = createLogger("Service1");
      const logger2 = createLogger("Service2");

      logger1.info("Message from service 1");
      logger2.info("Message from service 2");

      expect(mockWinstonLogger.info).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          message: "[Service1] Message from service 1",
        }),
      );
      expect(mockWinstonLogger.info).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          message: "[Service2] Message from service 2",
        }),
      );
    });

    it("should create independent logger instances", () => {
      const logger1 = createLogger("Original");
      const logger2 = createLogger("Independent");

      // Modify one logger's context
      logger1.setContext("Modified");

      logger1.info("Message 1");
      logger2.info("Message 2");

      expect(mockWinstonLogger.info).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          message: "[Modified] Message 1",
        }),
      );
      expect(mockWinstonLogger.info).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          message: "[Independent] Message 2",
        }),
      );
    });
  });

  describe("No Client Error Forwarding on Server", () => {
    it("should not attempt to send error to server when in server environment", () => {
      // Mock fetch to verify it's not called
      const mockFetch = vi.fn();
      global.fetch = mockFetch;

      logger.error("Server error", { code: 500 });

      expect(mockWinstonLogger.error).toHaveBeenCalled();
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });
});
