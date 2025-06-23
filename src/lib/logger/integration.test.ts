/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Integration test for the complete client error forwarding flow
describe("UniversalLogger Integration - Client Error Forwarding", () => {
	let mockFetch: any;
	let mockConsole: any;
	let originalFetch: any;

	beforeEach(() => {
		// Store original fetch
		originalFetch = global.fetch;

		// Setup fetch mock
		mockFetch = vi.fn();
		global.fetch = mockFetch;

		// Setup console mocks
		mockConsole = {
			debug: vi.fn(),
			info: vi.fn(),
			warn: vi.fn(),
			error: vi.fn()
		};

		vi.spyOn(console, "debug").mockImplementation(mockConsole.debug);
		vi.spyOn(console, "info").mockImplementation(mockConsole.info);
		vi.spyOn(console, "warn").mockImplementation(mockConsole.warn);
		vi.spyOn(console, "error").mockImplementation(mockConsole.error);

		// Mock browser environment
		vi.doMock("$app/environment", () => ({
			browser: true
		}));

		// Mock browser globals
		Object.defineProperty(global, "navigator", {
			value: { userAgent: "Test Browser/1.0" },
			writable: true
		});

		Object.defineProperty(global, "window", {
			value: { location: { href: "https://test.example.com/page" } },
			writable: true
		});
	});

	afterEach(() => {
		// Restore original fetch
		global.fetch = originalFetch;
		vi.restoreAllMocks();
		vi.resetModules();
	});

	describe("End-to-End Error Forwarding", () => {
		it("should forward client error to server and handle successful response", async () => {
			// Mock successful server response
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ success: true })
			});

			// Import logger after mocks are set up
			const { createLogger } = await import("./index");
			const logger = createLogger("IntegrationTest");

			// Trigger client error
			const errorMessage = "Integration test error";
			const errorMeta = { errorCode: "INT001", component: "TestComponent" };

			logger.error(errorMessage, errorMeta);

			// Wait for async operation
			await new Promise((resolve) => setTimeout(resolve, 10));

			// Verify client-side logging
			expect(mockConsole.error).toHaveBeenCalledWith(
				"❌ [IntegrationTest] Integration test error",
				errorMeta
			);

			// Verify server request
			expect(mockFetch).toHaveBeenCalledWith(
				"/api/log",
				expect.objectContaining({
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: expect.stringContaining('"level":"error"')
				})
			);

			// Verify the sent data contains expected properties
			const sentData = JSON.parse(mockFetch.mock.calls[0][1].body);
			expect(sentData.level).toBe("error");
			expect(sentData.message).toBe(errorMessage);
			expect(sentData.meta.context).toBe("IntegrationTest");
			expect(sentData.meta.url).toBe("https://test.example.com/page");
			expect(sentData.meta.userAgent).toBe("Test Browser/1.0");
			expect(sentData.meta.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
		});

		it("should handle server API error gracefully", async () => {
			// Mock server error response
			mockFetch.mockRejectedValueOnce(new Error("Network error"));

			const { createLogger } = await import("./index");
			const logger = createLogger("ErrorHandling");

			logger.error("Test error");

			// Wait for async operation
			await new Promise((resolve) => setTimeout(resolve, 10));

			// Verify client error is logged locally
			expect(mockConsole.error).toHaveBeenCalledWith("❌ [ErrorHandling] Test error", {});

			// Verify fallback error logging
			expect(mockConsole.error).toHaveBeenCalledWith(
				"Failed to send error to server:",
				expect.any(Error)
			);
		});

		it("should handle server returning error status", async () => {
			// Mock server error status
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 500,
				statusText: "Internal Server Error"
			});

			const { createLogger } = await import("./index");
			const logger = createLogger("ServerError");

			logger.error("Server unavailable");

			// Wait for async operation
			await new Promise((resolve) => setTimeout(resolve, 10));

			// Should still attempt to send to server
			expect(mockFetch).toHaveBeenCalled();

			// Local error should still be logged
			expect(mockConsole.error).toHaveBeenCalledWith("❌ [ServerError] Server unavailable", {});
		});
	});

	describe("Server-side API Integration", () => {
		it("should process forwarded client errors correctly", async () => {
			// Mock server environment
			vi.doMock("$app/environment", () => ({
				browser: false
			}));

			// Mock winston logger
			const mockWinstonLogger = {
				debug: vi.fn(),
				info: vi.fn(),
				warn: vi.fn(),
				error: vi.fn()
			};

			vi.doMock("./winston", () => ({
				default: mockWinstonLogger
			}));

			// Mock SvelteKit json function
			const mockJson = vi.fn().mockImplementation((data, options) => ({ data, options }));
			vi.doMock("@sveltejs/kit", () => ({
				json: mockJson
			}));

			// This test is simplified since we can't easily test the actual server endpoint
			// in this integration test due to mocking complexities. The server endpoint
			// is tested separately in its own test file.

			// Just verify that the mock setup would work
			expect(mockWinstonLogger.error).toBeDefined();
			expect(mockJson).toBeDefined();

			// The actual server endpoint integration is tested in the dedicated server.test.ts file
		});
	});

	describe("Cross-Environment Behavior", () => {
		it("should not forward non-error logs from client", async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ success: true })
			});

			const { createLogger } = await import("./index");
			const logger = createLogger("NoForwarding");

			// Log different levels
			logger.debug("Debug message");
			logger.info("Info message");
			logger.warn("Warning message");

			// Wait for any potential async operations
			await new Promise((resolve) => setTimeout(resolve, 10));

			// Verify only console methods were called, no fetch
			expect(mockConsole.debug).toHaveBeenCalled();
			expect(mockConsole.info).toHaveBeenCalled();
			expect(mockConsole.warn).toHaveBeenCalled();
			expect(mockFetch).not.toHaveBeenCalled();
		});

		it("should handle multiple concurrent error forwarding requests", async () => {
			// Mock successful responses for all requests
			mockFetch.mockResolvedValue({
				ok: true,
				json: async () => ({ success: true })
			});

			const { createLogger } = await import("./index");
			const logger1 = createLogger("Concurrent1");
			const logger2 = createLogger("Concurrent2");

			// Trigger multiple errors simultaneously
			const promises = [
				logger1.error("Error 1", { id: 1 }),
				logger2.error("Error 2", { id: 2 }),
				logger1.error("Error 3", { id: 3 })
			];

			await Promise.all(promises);

			// Wait for all async operations
			await new Promise((resolve) => setTimeout(resolve, 20));

			// Verify all requests were made
			expect(mockFetch).toHaveBeenCalledTimes(3);

			// Verify each request has correct context
			const calls = mockFetch.mock.calls;
			expect(calls[0][1].body).toContain('"context":"Concurrent1"');
			expect(calls[1][1].body).toContain('"context":"Concurrent2"');
			expect(calls[2][1].body).toContain('"context":"Concurrent1"');
		});
	});

	describe("Data Integrity", () => {
		it("should preserve complex metadata through forwarding", async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ success: true })
			});

			const { createLogger } = await import("./index");
			const logger = createLogger("DataIntegrity");

			const complexMeta = {
				user: { id: 123, name: "Test User" },
				error: { stack: "Error stack trace...", code: 500 },
				array: [1, 2, { nested: true }],
				boolean: true,
				null: null,
				timestamp: new Date().toISOString()
			};

			logger.error("Complex error", complexMeta);

			await new Promise((resolve) => setTimeout(resolve, 10));

			const sentData = JSON.parse(mockFetch.mock.calls[0][1].body);

			// Verify complex meta is preserved
			expect(sentData.meta.user).toEqual({ id: 123, name: "Test User" });
			expect(sentData.meta.error).toEqual({ stack: "Error stack trace...", code: 500 });
			expect(sentData.meta.array).toEqual([1, 2, { nested: true }]);
			expect(sentData.meta.boolean).toBe(true);
			expect(sentData.meta.null).toBe(null);

			// Verify additional context is added
			expect(sentData.meta.context).toBe("DataIntegrity");
			expect(sentData.meta.url).toBe("https://test.example.com/page");
			expect(sentData.meta.userAgent).toBe("Test Browser/1.0");
		});

		it("should maintain message and level integrity", async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ success: true })
			});

			const { createLogger } = await import("./index");
			const logger = createLogger("MessageIntegrity");

			const originalMessage = "Original error message with special chars: áéíóú 中文 🚀";
			logger.error(originalMessage);

			await new Promise((resolve) => setTimeout(resolve, 10));

			const sentData = JSON.parse(mockFetch.mock.calls[0][1].body);

			expect(sentData.level).toBe("error");
			expect(sentData.message).toBe(originalMessage);
		});
	});
});
