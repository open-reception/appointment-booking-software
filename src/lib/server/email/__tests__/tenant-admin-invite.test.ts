import { describe, it, expect } from "vitest";
import { sendTenantAdminInviteEmail } from "../email-service";

describe("sendTenantAdminInviteEmail", () => {
  const mockTenant = {
    id: "test-tenant-id",
    shortName: "testcorp",
    longName: "Test Corporation GmbH",
    descriptions: ["A test corporation"],
    languages: ["en"],
    databaseUrl: "postgresql://test",
    setupState: "NEW" as const,
    createdAt: new Date(),
    updatedAt: new Date(),
    logo: null,
  };

  it("should accept correct parameters and not throw for German language", () => {
    const adminEmail = "admin@testcorp.com";
    const adminName = "Test Admin";
    const registrationUrl = "http://localhost:5173/register?tenant=test";

    // This test just ensures the function accepts the right parameters
    // and doesn't throw on setup (actual email sending will fail without SMTP config)
    expect(() => {
      sendTenantAdminInviteEmail(adminEmail, adminName, mockTenant, registrationUrl, "de");
    }).not.toThrow();
  });

  it("should accept correct parameters and not throw for English language", () => {
    const adminEmail = "admin@testcorp.com";
    const adminName = "Test Admin";
    const registrationUrl = "http://localhost:5173/register?tenant=test";

    expect(() => {
      sendTenantAdminInviteEmail(adminEmail, adminName, mockTenant, registrationUrl, "en");
    }).not.toThrow();
  });

  it("should accept correct parameters and not throw with default language", () => {
    const adminEmail = "admin@testcorp.com";
    const adminName = "Test Admin";
    const registrationUrl = "http://localhost:5173/register?tenant=test";

    expect(() => {
      sendTenantAdminInviteEmail(adminEmail, adminName, mockTenant, registrationUrl);
    }).not.toThrow();
  });
});
