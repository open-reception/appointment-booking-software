import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { generateBaseUrl } from "../email-service";
import type { SelectTenant } from "$lib/server/db/central-schema";

// Mock NODE_ENV
const mockEnv = vi.hoisted(() => ({ NODE_ENV: "development" }));

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

  describe("Development/Local Environment", () => {
    it("should return localhost URL regardless of tenant", () => {
      const requestUrl = new URL("http://localhost:5173");
      const tenant: SelectTenant = {
        id: "tenant-1",
        shortName: "acme",
        longName: "ACME Corp",
        logo: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        descriptions: { en: "" },
        languages: ["en"],
        defaultLanguage: "en",
        databaseUrl: "",
        setupState: "NEW",
        links: { website: "", imprint: "", privacyStatement: "" },
      };

      const result = generateBaseUrl(requestUrl, tenant);
      expect(result).toBe("http://localhost:5173");
    });

    it("should return localhost URL for null tenant", () => {
      const requestUrl = new URL("http://localhost:3000");

      const result = generateBaseUrl(requestUrl, null);
      expect(result).toBe("http://localhost:3000");
    });

    it("should preserve port for localhost", () => {
      const requestUrl = new URL("http://localhost:8080");
      const tenant: SelectTenant = {
        id: "tenant-1",
        shortName: "test",
        longName: "Test Corp",
        descriptions: { en: "" },
        languages: ["en"],
        defaultLanguage: "en",
        databaseUrl: "",
        setupState: "NEW",
        logo: null,
        links: { website: "", imprint: "", privacyStatement: "" },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = generateBaseUrl(requestUrl, tenant);
      expect(result).toBe("http://localhost:8080");
    });

    it("should handle 127.x.x.x addresses", () => {
      const requestUrl = new URL("http://127.0.0.1:3000");
      const tenant: SelectTenant = {
        id: "tenant-1",
        shortName: "acme",
        longName: "ACME Corp",
        descriptions: { en: "" },
        languages: ["en"],
        defaultLanguage: "en",
        databaseUrl: "",
        setupState: "NEW",
        logo: null,
        links: { website: "", imprint: "", privacyStatement: "" },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = generateBaseUrl(requestUrl, tenant);
      expect(result).toBe("http://127.0.0.1:3000");
    });

    it("should handle 192.168.x.x addresses", () => {
      const requestUrl = new URL("http://192.168.1.100:8080");
      const tenant: SelectTenant = {
        id: "tenant-1",
        shortName: "acme",
        longName: "ACME Corp",
        descriptions: { en: "" },
        languages: ["en"],
        defaultLanguage: "en",
        databaseUrl: "",
        setupState: "NEW",
        logo: null,
        links: { website: "", imprint: "", privacyStatement: "" },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = generateBaseUrl(requestUrl, tenant);
      expect(result).toBe("http://192.168.1.100:8080");
    });
  });

  describe("Production Environment", () => {
    beforeEach(() => {
      mockEnv.NODE_ENV = "production";
    });

    it("should return main domain for null tenant", () => {
      const requestUrl = new URL("https://example.com");

      const result = generateBaseUrl(requestUrl, null);
      expect(result).toBe("https://example.com");
    });

    it("should return main domain with port for null tenant", () => {
      const requestUrl = new URL("https://example.com:8443");

      const result = generateBaseUrl(requestUrl, null);
      expect(result).toBe("https://example.com:8443");
    });

    it("should create subdomain URL for tenant on main domain", () => {
      const requestUrl = new URL("https://example.com");
      const tenant: SelectTenant = {
        id: "tenant-1",
        shortName: "acme",
        longName: "ACME Corp",
        descriptions: { en: "" },
        languages: ["en"],
        defaultLanguage: "en",
        databaseUrl: "",
        setupState: "NEW",
        logo: null,
        links: { website: "", imprint: "", privacyStatement: "" },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = generateBaseUrl(requestUrl, tenant);
      expect(result).toBe("https://acme.example.com");
    });

    it("should create subdomain URL with port", () => {
      const requestUrl = new URL("https://example.com:8443");
      const tenant: SelectTenant = {
        id: "tenant-1",
        shortName: "acme",
        longName: "ACME Corp",
        descriptions: { en: "" },
        languages: ["en"],
        defaultLanguage: "en",
        databaseUrl: "",
        setupState: "NEW",
        logo: null,
        links: { website: "", imprint: "", privacyStatement: "" },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = generateBaseUrl(requestUrl, tenant);
      expect(result).toBe("https://acme.example.com:8443");
    });

    it("should replace existing subdomain with tenant shortName", () => {
      const requestUrl = new URL("https://old-tenant.example.com");
      const tenant: SelectTenant = {
        id: "tenant-2",
        shortName: "new-tenant",
        longName: "New Tenant Corp",
        descriptions: { en: "" },
        languages: ["en"],
        defaultLanguage: "en",
        databaseUrl: "",
        setupState: "NEW",
        logo: null,
        links: { website: "", imprint: "", privacyStatement: "" },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = generateBaseUrl(requestUrl, tenant);
      expect(result).toBe("https://new-tenant.example.com");
    });

    it("should replace existing subdomain with port", () => {
      const requestUrl = new URL("https://old-tenant.example.com:8443");
      const tenant: SelectTenant = {
        id: "tenant-2",
        shortName: "new-tenant",
        longName: "New Tenant Corp",
        descriptions: { en: "" },
        languages: ["en"],
        defaultLanguage: "en",
        databaseUrl: "",
        setupState: "NEW",
        logo: null,
        links: { website: "", imprint: "", privacyStatement: "" },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = generateBaseUrl(requestUrl, tenant);
      expect(result).toBe("https://new-tenant.example.com:8443");
    });

    it("should handle complex subdomains (keep last two parts)", () => {
      const requestUrl = new URL("https://admin.api.example.com");
      const tenant: SelectTenant = {
        id: "tenant-1",
        shortName: "tenant",
        longName: "Tenant Corp",
        descriptions: { en: "" },
        languages: ["en"],
        defaultLanguage: "en",
        databaseUrl: "",
        setupState: "NEW",
        logo: null,
        links: { website: "", imprint: "", privacyStatement: "" },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = generateBaseUrl(requestUrl, tenant);
      expect(result).toBe("https://tenant.example.com");
    });

    it("should handle http protocol", () => {
      const requestUrl = new URL("http://example.com");
      const tenant: SelectTenant = {
        id: "tenant-1",
        shortName: "acme",
        longName: "ACME Corp",
        descriptions: { en: "" },
        languages: ["en"],
        defaultLanguage: "en",
        databaseUrl: "",
        setupState: "NEW",
        logo: null,
        links: { website: "", imprint: "", privacyStatement: "" },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = generateBaseUrl(requestUrl, tenant);
      expect(result).toBe("http://acme.example.com");
    });

    it("should return main domain when tenant has no shortName", () => {
      const requestUrl = new URL("https://example.com");
      const tenant: SelectTenant = {
        id: "tenant-1",
        shortName: "", // Empty shortName
        longName: "ACME Corp",
        descriptions: { en: "" },
        languages: ["en"],
        defaultLanguage: "en",
        databaseUrl: "",
        setupState: "NEW",
        logo: null,
        links: { website: "", imprint: "", privacyStatement: "" },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = generateBaseUrl(requestUrl, tenant);
      expect(result).toBe("https://example.com");
    });
  });

  describe("Edge Cases", () => {
    it("should handle single domain names in production", () => {
      mockEnv.NODE_ENV = "production";
      const requestUrl = new URL("https://app");
      const tenant: SelectTenant = {
        id: "tenant-1",
        shortName: "acme",
        longName: "ACME Corp",
        descriptions: { en: "" },
        languages: ["en"],
        defaultLanguage: "en",
        databaseUrl: "",
        setupState: "NEW",
        logo: null,
        links: { website: "", imprint: "", privacyStatement: "" },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = generateBaseUrl(requestUrl, tenant);
      expect(result).toBe("https://acme.app");
    });

    it("should handle localhost in production (still treated as development)", () => {
      mockEnv.NODE_ENV = "production";
      const requestUrl = new URL("https://localhost:8443");
      const tenant: SelectTenant = {
        id: "tenant-1",
        shortName: "acme",
        longName: "ACME Corp",
        descriptions: { en: "" },
        languages: ["en"],
        defaultLanguage: "en",
        databaseUrl: "",
        setupState: "NEW",
        logo: null,
        links: { website: "", imprint: "", privacyStatement: "" },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = generateBaseUrl(requestUrl, tenant);
      expect(result).toBe("https://localhost:8443");
    });

    it("should handle IP addresses as development", () => {
      mockEnv.NODE_ENV = "production";
      const requestUrl = new URL("https://192.168.1.100:8443");
      const tenant: SelectTenant = {
        id: "tenant-1",
        shortName: "acme",
        longName: "ACME Corp",
        descriptions: { en: "" },
        languages: ["en"],
        defaultLanguage: "en",
        databaseUrl: "",
        setupState: "NEW",
        logo: null,
        links: { website: "", imprint: "", privacyStatement: "" },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = generateBaseUrl(requestUrl, tenant);
      expect(result).toBe("https://192.168.1.100:8443");
    });

    it("should handle default HTTP port (80)", () => {
      mockEnv.NODE_ENV = "production";
      const requestUrl = new URL("http://example.com:80");

      // URL constructor should handle port 80 correctly
      const result = generateBaseUrl(requestUrl, null);
      // Default HTTP port shouldn't be included in URL
      expect(result).toBe("http://example.com");
    });

    it("should handle default HTTPS port (443)", () => {
      mockEnv.NODE_ENV = "production";
      const requestUrl = new URL("https://example.com:443");

      // URL constructor should handle port 443 correctly
      const result = generateBaseUrl(requestUrl, null);
      // Default HTTPS port shouldn't be included in URL
      expect(result).toBe("https://example.com");
    });
  });
});
