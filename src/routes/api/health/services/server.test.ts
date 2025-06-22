import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./+server.js";

// Mock the database module
vi.mock("$lib/server/db", () => ({
	db: {
		execute: vi.fn()
	}
}));

// Mock the OpenAPI registration
vi.mock("$lib/server/openapi", () => ({
	registerOpenAPIRoute: vi.fn()
}));

// Mock os module
vi.mock("os", () => ({
	default: {
		freemem: vi.fn(),
		loadavg: vi.fn()
	}
}));

// Mock SvelteKit json helper
vi.mock("@sveltejs/kit", () => ({
	json: vi.fn((data) => ({
		json: () => Promise.resolve(data),
		data
	}))
}));

describe("/api/health/services", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("should return healthy status when database connection succeeds", async () => {
		const { db } = await import("$lib/server/db");
		const os = (await import("os")).default;

		// Mock successful database connection
		vi.mocked(db.execute).mockResolvedValue([] as any);

		// Mock system metrics
		vi.mocked(os.freemem).mockReturnValue(2048 * 1024 * 1024); // 2048 MB in bytes
		vi.mocked(os.loadavg).mockReturnValue([0.75, 0.5, 0.3]);

		const response = await GET();
		const data = await response.json();

		expect(data).toEqual({
			core: true,
			database: true,
			memory: 2048,
			load: 0.75
		});
	});

	it("should return unhealthy database status when connection fails", async () => {
		const { db } = await import("$lib/server/db");
		const os = (await import("os")).default;

		// Mock failed database connection
		vi.mocked(db.execute).mockRejectedValue(new Error("Connection failed"));

		// Mock system metrics
		vi.mocked(os.freemem).mockReturnValue(1024 * 1024 * 1024); // 1024 MB in bytes
		vi.mocked(os.loadavg).mockReturnValue([1.25, 1.0, 0.8]);

		const response = await GET();
		const data = await response.json();

		expect(data).toEqual({
			core: true,
			database: false,
			memory: 1024,
			load: 1.25
		});
	});

	it("should calculate memory in MB correctly", async () => {
		const { db } = await import("$lib/server/db");
		const os = (await import("os")).default;

		vi.mocked(db.execute).mockResolvedValue([] as any);

		// Test different memory values
		vi.mocked(os.freemem).mockReturnValue(512 * 1024 * 1024); // 512 MB in bytes
		vi.mocked(os.loadavg).mockReturnValue([0.1, 0.1, 0.1]);

		const response = await GET();
		const data = await response.json();

		expect(data.memory).toBe(512);
	});

	it("should round load average to 2 decimal places", async () => {
		const { db } = await import("$lib/server/db");
		const os = (await import("os")).default;

		vi.mocked(db.execute).mockResolvedValue([] as any);
		vi.mocked(os.freemem).mockReturnValue(1024 * 1024 * 1024);

		// Test load average rounding
		vi.mocked(os.loadavg).mockReturnValue([1.23456, 0.5, 0.3]);

		const response = await GET();
		const data = await response.json();

		expect(data.load).toBe(1.23);
	});

	it("should always return core as true", async () => {
		const { db } = await import("$lib/server/db");
		const os = (await import("os")).default;

		vi.mocked(db.execute).mockRejectedValue(new Error("Database error"));
		vi.mocked(os.freemem).mockReturnValue(0);
		vi.mocked(os.loadavg).mockReturnValue([10.0, 5.0, 2.0]);

		const response = await GET();
		const data = await response.json();

		expect(data.core).toBe(true);
	});
});
