import { describe, test, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/svelte";
import Page from "./+page.svelte";
import type { Locale } from "$i18n/runtime";

describe("/+page.svelte", () => {
  beforeEach(() => {
    // Mock fetch to avoid the "Invalid URL" error
    global.fetch = vi.fn(() =>
      Promise.resolve({
        json: () => Promise.resolve({ envOkay: true }),
      } as Response),
    );
  });

  test("should render h1", async () => {
    const mockData = {
      locale: "en" as Locale,
      streamed: {
        isEnvOk: Promise.resolve(true),
      },
    };
    render(Page, {
      props: {
        data: mockData,
      },
    });
    await mockData.streamed.isEnvOk;
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
  });
});
