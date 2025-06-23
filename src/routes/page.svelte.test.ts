import { describe, test, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/svelte";
import Page from "./+page.svelte";

describe("/+page.svelte", () => {
	beforeEach(() => {
		// Mock fetch to avoid the "Invalid URL" error
		global.fetch = vi.fn(() =>
			Promise.resolve({
				json: () => Promise.resolve({ envOkay: true })
			} as Response)
		);
	});

	test("should render h1", () => {
		render(Page);
		expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
	});
});
