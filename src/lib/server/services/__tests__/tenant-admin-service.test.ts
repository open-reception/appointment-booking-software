/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the database module
vi.mock("../../db", () => ({
  centralDb: {
    insert: vi.fn(),
    select: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  getTenantDb: vi.fn(),
}));

// Mock TenantConfig
vi.mock("../../db/tenant-config", () => ({
  TenantConfig: {
    create: vi.fn(),
  },
}));

// Mock TenantMigrationService
vi.mock("../tenant-migration-service", () => ({
  TenantMigrationService: {
    createAndInitializeTenantDatabase: vi.fn(),
    parseDatabaseUrl: vi.fn(),
  },
}));

// Mock environment variables
vi.mock("$env/dynamic/private", () => ({
  env: {
    DATABASE_URL: "postgresql://user:pass@localhost:5432/central_db",
  },
}));

// Import the service after mocks are set up
import { TenantAdminService } from "../tenant-admin-service";

describe("TenantAdminService", () => {
  let mockCentralDb: any;
  let mockGetTenantDb: any;
  let mockTenantConfig: any;
  let mockTenantMigrationService: any;

  // Helper function to create mock select builder for getTenantById
  const createMockSelectBuilder = (tenantData: any[] = []) => ({
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(tenantData),
  });

  // Helper function to create mock tenant data
  const createMockTenant = (tenantId: string) => ({
    id: tenantId,
    shortName: "test-clinic",
    longName: "Test Clinic",
    descriptions: { en: "A test clinic" },
    languages: ["en"],
    databaseUrl: "postgresql://user:pass@localhost:5432/test-clinic",
    setupState: "NEW",
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  beforeEach(async () => {
    vi.clearAllMocks();

    // Get mocked modules
    const dbModule = await vi.importMock("../../db");
    mockCentralDb = dbModule.centralDb;
    mockGetTenantDb = dbModule.getTenantDb;

    const configModule = await vi.importMock("../../db/tenant-config");
    mockTenantConfig = configModule.TenantConfig;

    const migrationModule = await vi.importMock("../tenant-migration-service");
    mockTenantMigrationService = migrationModule.TenantMigrationService;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("createTenant", () => {
    it("should create a new tenant with default configuration", async () => {
      const newTenant = {
        shortName: "test-clinic",
        longName: "",
        descriptions: { en: "" },
        languages: ["en"],
        defaultLanguage: "en",
        description: "A test clinic",
        links: { website: "", imprint: "", privacyStatement: "" },
      };

      const mockCreatedTenant = {
        id: "tenant-123",
        ...newTenant,
        databaseUrl: "postgresql://user:pass@localhost:5432/test-clinic",
      };

      const mockConfig = {
        setConfig: vi.fn(),
      };

      const mockInsertBuilder = {
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([mockCreatedTenant]),
      };

      const mockSelectBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      };

      const mockDeleteBuilder = {
        where: vi.fn().mockResolvedValue({ count: 1 }),
      };

      mockCentralDb.insert.mockReturnValue(mockInsertBuilder);
      mockCentralDb.select.mockReturnValue(mockSelectBuilder);
      mockCentralDb.delete.mockReturnValue(mockDeleteBuilder);
      mockTenantConfig.create.mockResolvedValue(mockConfig);
      mockTenantMigrationService.createAndInitializeTenantDatabase.mockResolvedValue();

      const result = await TenantAdminService.createTenant(newTenant);

      expect(mockCentralDb.insert).toHaveBeenCalled();
      expect(mockInsertBuilder.values).toHaveBeenCalledWith({
        ...newTenant,
        databaseUrl: "postgresql://user:pass@localhost:5432/test-clinic",
      });
      expect(mockTenantMigrationService.createAndInitializeTenantDatabase).toHaveBeenCalledWith(
        "postgresql://user:pass@localhost:5432/test-clinic",
      );
      expect(mockTenantConfig.create).toHaveBeenCalledWith("tenant-123");
      expect(mockConfig.setConfig).toHaveBeenCalledWith("brandColor", "#E11E15");
      expect(result).toBeInstanceOf(TenantAdminService);
    });

    it("should rollback tenant creation if database initialization fails", async () => {
      const newTenant = {
        shortName: "test-clinic",
        descriptions: "A test clinic",
      };

      const mockCreatedTenant = {
        id: "tenant-123",
        ...newTenant,
        databaseUrl: "postgresql://user:pass@localhost:5432/test-clinic",
      };

      const mockInsertBuilder = {
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([mockCreatedTenant]),
      };

      const mockSelectBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      };

      const mockDeleteBuilder = {
        where: vi.fn().mockResolvedValue({ count: 1 }),
      };

      mockCentralDb.insert.mockReturnValue(mockInsertBuilder);
      mockCentralDb.select.mockReturnValue(mockSelectBuilder);
      mockCentralDb.delete.mockReturnValue(mockDeleteBuilder);
      mockTenantMigrationService.createAndInitializeTenantDatabase.mockRejectedValue(
        new Error("Database initialization failed"),
      );

      await expect(TenantAdminService.createTenant(newTenant)).rejects.toThrow(
        "Failed to initialize tenant database",
      );

      expect(mockCentralDb.delete).toHaveBeenCalled();
      expect(mockDeleteBuilder.where).toHaveBeenCalled();
    });
  });

  describe("getTenantById", () => {
    it("should get tenant by ID and initialize configuration", async () => {
      const tenantId = "tenant-123";
      const mockTenant = createMockTenant(tenantId);

      const mockConfig = {
        setConfig: vi.fn(),
        getConfig: vi.fn(),
      };

      const mockSelectBuilder = createMockSelectBuilder([mockTenant]);

      mockTenantConfig.create.mockResolvedValue(mockConfig);
      mockCentralDb.select.mockReturnValue(mockSelectBuilder);

      const result = await TenantAdminService.getTenantById(tenantId);

      expect(mockTenantConfig.create).toHaveBeenCalledWith(tenantId);
      expect(mockCentralDb.select).toHaveBeenCalled();
      expect(mockSelectBuilder.from).toHaveBeenCalled();
      expect(mockSelectBuilder.where).toHaveBeenCalled();
      expect(mockSelectBuilder.limit).toHaveBeenCalledWith(1);
      expect(result).toBeInstanceOf(TenantAdminService);
      expect(result.tenantId).toBe(tenantId);
    });

    it("should throw NotFoundError when tenant does not exist", async () => {
      const tenantId = "non-existent";
      const mockConfig = {
        setConfig: vi.fn(),
        getConfig: vi.fn(),
      };

      const mockSelectBuilder = createMockSelectBuilder([]); // Empty array = no tenant found

      mockTenantConfig.create.mockResolvedValue(mockConfig);
      mockCentralDb.select.mockReturnValue(mockSelectBuilder);

      await expect(TenantAdminService.getTenantById(tenantId)).rejects.toThrow(
        "Tenant with ID non-existent not found",
      );

      expect(mockCentralDb.select).toHaveBeenCalled();
      expect(mockSelectBuilder.from).toHaveBeenCalled();
      expect(mockSelectBuilder.where).toHaveBeenCalled();
      expect(mockSelectBuilder.limit).toHaveBeenCalledWith(1);
    });
  });

  describe("getDb", () => {
    it("should return database connection", async () => {
      const tenantId = "tenant-123";
      const mockTenant = createMockTenant(tenantId);
      const mockConfig = { setConfig: vi.fn() };
      const mockTenantDb = {
        select: vi.fn(),
        insert: vi.fn(),
        update: vi.fn(),
      };

      const mockSelectBuilder = createMockSelectBuilder([mockTenant]);

      mockTenantConfig.create.mockResolvedValue(mockConfig);
      mockCentralDb.select.mockReturnValue(mockSelectBuilder);
      mockGetTenantDb.mockResolvedValue(mockTenantDb);

      const service = await TenantAdminService.getTenantById(tenantId);
      const db = await service.getDb();

      expect(mockGetTenantDb).toHaveBeenCalledWith(tenantId);
      expect(db).toBe(mockTenantDb);
    });

    it("should cache database connection", async () => {
      const tenantId = "tenant-123";
      const mockTenant = createMockTenant(tenantId);
      const mockConfig = { setConfig: vi.fn() };
      const mockTenantDb = { select: vi.fn() };

      const mockSelectBuilder = createMockSelectBuilder([mockTenant]);

      mockTenantConfig.create.mockResolvedValue(mockConfig);
      mockCentralDb.select.mockReturnValue(mockSelectBuilder);
      mockGetTenantDb.mockResolvedValue(mockTenantDb);

      const service = await TenantAdminService.getTenantById(tenantId);

      // First call
      await service.getDb();
      // Second call should use cache
      await service.getDb();

      expect(mockGetTenantDb).toHaveBeenCalledTimes(1);
    });
  });

  describe("configuration", () => {
    it("should provide access to tenant configuration", async () => {
      const tenantId = "tenant-123";
      const mockTenant = createMockTenant(tenantId);
      const mockConfig = {
        setConfig: vi.fn(),
        getConfig: vi.fn().mockReturnValue("test-value"),
      };

      const mockSelectBuilder = createMockSelectBuilder([mockTenant]);

      mockTenantConfig.create.mockResolvedValue(mockConfig);
      mockCentralDb.select.mockReturnValue(mockSelectBuilder);

      const service = await TenantAdminService.getTenantById(tenantId);
      const config = service.configuration;

      expect(config).toBe(mockConfig);
    });
  });

  describe("updateTenantData", () => {
    it("should update tenant data successfully", async () => {
      const tenantId = "tenant-123";
      const mockTenant = createMockTenant(tenantId);
      const updateData = {
        longName: "Updated Clinic Name",
        description: ["Updated description"],
        logo: "logo data",
      };

      const mockUpdatedTenant = {
        id: tenantId,
        shortName: "test-clinic",
        ...updateData,
        updatedAt: new Date(),
      };

      const mockConfig = { setConfig: vi.fn() };
      const mockSelectBuilder = createMockSelectBuilder([mockTenant]);
      const mockUpdateBuilder = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([mockUpdatedTenant]),
      };

      mockTenantConfig.create.mockResolvedValue(mockConfig);
      mockCentralDb.select.mockReturnValue(mockSelectBuilder);
      mockCentralDb.update.mockReturnValue(mockUpdateBuilder);

      const service = await TenantAdminService.getTenantById(tenantId);
      const result = await service.updateTenantData(updateData);

      expect(mockCentralDb.update).toHaveBeenCalled();
      expect(mockUpdateBuilder.set).toHaveBeenCalledWith({
        ...updateData,
        updatedAt: expect.any(Date),
      });
      expect(mockUpdateBuilder.where).toHaveBeenCalled();
      expect(result).toEqual(mockUpdatedTenant);
    });

    it("should throw NotFoundError when tenant not found", async () => {
      const tenantId = "tenant-123";
      const mockTenant = createMockTenant(tenantId);
      const updateData = { longName: "Updated Name" };

      const mockConfig = { setConfig: vi.fn() };
      const mockSelectBuilder = createMockSelectBuilder([mockTenant]);
      const mockUpdateBuilder = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([]),
      };

      mockTenantConfig.create.mockResolvedValue(mockConfig);
      mockCentralDb.select.mockReturnValue(mockSelectBuilder);
      mockCentralDb.update.mockReturnValue(mockUpdateBuilder);

      const service = await TenantAdminService.getTenantById(tenantId);

      await expect(service.updateTenantData(updateData)).rejects.toThrow(
        "Tenant with ID tenant-123 not found",
      );
    });
  });

  describe("updateTenantConfig", () => {
    it("should update tenant configuration successfully", async () => {
      const tenantId = "tenant-123";
      const mockTenant = createMockTenant(tenantId);
      const configUpdates = {
        brandColor: "#FF0000",
        maxChannels: 10,
        requireEmail: false,
      };

      const mockConfig = {
        setConfig: vi.fn().mockResolvedValue(undefined),
      };

      const mockSelectBuilder = createMockSelectBuilder([mockTenant]);

      mockTenantConfig.create.mockResolvedValue(mockConfig);
      mockCentralDb.select.mockReturnValue(mockSelectBuilder);

      const service = await TenantAdminService.getTenantById(tenantId);
      const result = await service.updateTenantConfig(configUpdates);

      expect(mockConfig.setConfig).toHaveBeenCalledTimes(3);
      expect(mockConfig.setConfig).toHaveBeenCalledWith("brandColor", "#FF0000");
      expect(mockConfig.setConfig).toHaveBeenCalledWith("maxChannels", 10);
      expect(mockConfig.setConfig).toHaveBeenCalledWith("requireEmail", false);

      expect(result).toEqual([
        { key: "brandColor", value: "#FF0000" },
        { key: "maxChannels", value: 10 },
        { key: "requireEmail", value: false },
      ]);
    });

    it("should handle empty config updates", async () => {
      const tenantId = "tenant-123";
      const mockTenant = createMockTenant(tenantId);
      const configUpdates = {};

      const mockConfig = {
        setConfig: vi.fn().mockResolvedValue(undefined),
      };

      const mockSelectBuilder = createMockSelectBuilder([mockTenant]);

      mockTenantConfig.create.mockResolvedValue(mockConfig);
      mockCentralDb.select.mockReturnValue(mockSelectBuilder);

      const service = await TenantAdminService.getTenantById(tenantId);
      const result = await service.updateTenantConfig(configUpdates);

      expect(mockConfig.setConfig).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });

    it("should propagate config errors", async () => {
      const tenantId = "tenant-123";
      const mockTenant = createMockTenant(tenantId);
      const configUpdates = { brandColor: "#FF0000" };

      const mockConfig = {
        setConfig: vi.fn().mockRejectedValue(new Error("Config error")),
      };

      const mockSelectBuilder = createMockSelectBuilder([mockTenant]);

      mockTenantConfig.create.mockResolvedValue(mockConfig);
      mockCentralDb.select.mockReturnValue(mockSelectBuilder);

      const service = await TenantAdminService.getTenantById(tenantId);

      await expect(service.updateTenantConfig(configUpdates)).rejects.toThrow("Config error");
    });
  });

  describe("deleteTenant", () => {
    it("should delete tenant and all associated data successfully", async () => {
      const tenantId = "tenant-123";
      const mockTenant = {
        id: tenantId,
        shortName: "test-clinic",
        longName: "Test Clinic",
        databaseUrl: "postgresql://user:pass@localhost:5432/test-clinic",
      };

      const mockDeletedUsers = [
        { id: "user-1", email: "admin@test.com", role: "TENANT_ADMIN" },
        { id: "user-2", email: "staff@test.com", role: "STAFF" },
      ];

      const mockUpdatedGlobalAdmins = [
        { id: "global-1", email: "global@system.com", role: "GLOBAL_ADMIN" },
      ];

      const mockDeletedConfigs = [
        { id: "config-1", name: "brandColor" },
        { id: "config-2", name: "maxChannels" },
      ];

      const mockConfig = { setConfig: vi.fn() };

      // Mock database query builders
      const mockSelectBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([mockTenant]),
      };

      const mockUpdateBuilder = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue(mockUpdatedGlobalAdmins),
      };

      const mockDeleteUserBuilder = {
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue(mockDeletedUsers),
      };

      const mockDeleteConfigBuilder = {
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue(mockDeletedConfigs),
      };

      const mockDeleteTenantBuilder = {
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([mockTenant]),
      };

      // Mock database connection ending
      const mockAdminClient = {
        unsafe: vi.fn().mockResolvedValue([]),
        end: vi.fn().mockResolvedValue(undefined),
      };

      // Mock postgres import
      vi.doMock("postgres", () => ({
        default: vi.fn(() => mockAdminClient),
      }));

      mockTenantConfig.create.mockResolvedValue(mockConfig);
      mockCentralDb.select.mockReturnValue(mockSelectBuilder);
      mockCentralDb.update.mockReturnValue(mockUpdateBuilder);

      // First delete call for users, second for configs, third for tenant
      mockCentralDb.delete
        .mockReturnValueOnce(mockDeleteUserBuilder)
        .mockReturnValueOnce(mockDeleteConfigBuilder)
        .mockReturnValueOnce(mockDeleteTenantBuilder);

      mockTenantMigrationService.parseDatabaseUrl.mockReturnValue({
        host: "localhost",
        port: 5432,
        database: "test-clinic",
        username: "user",
        password: "pass",
      });

      const service = await TenantAdminService.getTenantById(tenantId);
      //
      (service as any)["#tenant"] = mockTenant; // Set private field for testing

      const result = await service.deleteTenant();

      // Verify user updates (global admins)
      expect(mockCentralDb.update).toHaveBeenCalled();
      expect(mockUpdateBuilder.set).toHaveBeenCalledWith({
        tenantId: null,
        updatedAt: expect.any(Date),
      });

      // Verify user deletions (non-global-admins)
      expect(mockCentralDb.delete).toHaveBeenCalledTimes(3);
      expect(mockDeleteUserBuilder.where).toHaveBeenCalled();
      expect(mockDeleteUserBuilder.returning).toHaveBeenCalled();

      // Verify config deletions
      expect(mockDeleteConfigBuilder.where).toHaveBeenCalled();
      expect(mockDeleteConfigBuilder.returning).toHaveBeenCalled();

      // Verify database parsing and dropping
      expect(mockTenantMigrationService.parseDatabaseUrl).toHaveBeenCalledWith(
        mockTenant.databaseUrl,
      );
      expect(mockAdminClient.unsafe).toHaveBeenCalledWith(
        expect.stringContaining("pg_terminate_backend"),
      );
      expect(mockAdminClient.unsafe).toHaveBeenCalledWith(`DROP DATABASE IF EXISTS "test-clinic"`);
      expect(mockAdminClient.end).toHaveBeenCalled();

      // Verify tenant deletion
      expect(mockDeleteTenantBuilder.where).toHaveBeenCalled();
      expect(mockDeleteTenantBuilder.returning).toHaveBeenCalled();

      // Verify result
      expect(result).toEqual({
        tenantId,
        shortName: "test-clinic",
        deletedUsersCount: 2,
        updatedGlobalAdminsCount: 1,
        deletedConfigsCount: 2,
        deletedUsers: mockDeletedUsers,
        updatedGlobalAdmins: mockUpdatedGlobalAdmins,
      });
    });

    it("should throw NotFoundError when tenant does not exist during deletion", async () => {
      const tenantId = "non-existent";

      // For deleteTenant: create a service instance with manually set tenant ID
      const service = new (TenantAdminService as any)(tenantId);

      // Set up mock for the internal select query in deleteTenant (when #tenant is null)
      const mockSelectBuilder = createMockSelectBuilder([]); // Empty result = tenant not found
      mockCentralDb.select.mockReturnValue(mockSelectBuilder);

      await expect(service.deleteTenant()).rejects.toThrow("Tenant with ID non-existent not found");

      expect(mockCentralDb.select).toHaveBeenCalled();
      expect(mockSelectBuilder.from).toHaveBeenCalled();
      expect(mockSelectBuilder.where).toHaveBeenCalled();
      expect(mockSelectBuilder.limit).toHaveBeenCalledWith(1);
    });

    it("should continue with deletion even if database drop fails", async () => {
      const tenantId = "tenant-123";
      const mockTenant = {
        id: tenantId,
        shortName: "test-clinic",
        longName: "Test Clinic",
        databaseUrl: "postgresql://user:pass@localhost:5432/test-clinic",
      };

      const mockConfig = { setConfig: vi.fn() };

      // Mock successful database operations but failing database drop
      const mockSelectBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([mockTenant]),
      };

      const mockUpdateBuilder = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([]),
      };

      const mockDeleteBuilder = {
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([]),
      };

      const mockDeleteTenantBuilder = {
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([mockTenant]),
      };

      // Mock failing database drop
      const mockAdminClient = {
        unsafe: vi.fn().mockRejectedValue(new Error("Database drop failed")),
        end: vi.fn().mockResolvedValue(undefined),
      };

      vi.doMock("postgres", () => ({
        default: vi.fn(() => mockAdminClient),
      }));

      mockTenantConfig.create.mockResolvedValue(mockConfig);
      mockCentralDb.select.mockReturnValue(mockSelectBuilder);
      mockCentralDb.update.mockReturnValue(mockUpdateBuilder);
      mockCentralDb.delete
        .mockReturnValueOnce(mockDeleteBuilder) // users
        .mockReturnValueOnce(mockDeleteBuilder) // configs
        .mockReturnValueOnce(mockDeleteTenantBuilder); // tenant

      mockTenantMigrationService.parseDatabaseUrl.mockReturnValue({
        host: "localhost",
        port: 5432,
        database: "test-clinic",
        username: "user",
        password: "pass",
      });

      const service = await TenantAdminService.getTenantById(tenantId);
      (service as any)["#tenant"] = mockTenant;

      // Should not throw error even if database drop fails
      const result = await service.deleteTenant();

      expect(result.tenantId).toBe(tenantId);
      expect(result.shortName).toBe("test-clinic");

      // Verify tenant record was still deleted
      expect(mockDeleteTenantBuilder.where).toHaveBeenCalled();
      expect(mockDeleteTenantBuilder.returning).toHaveBeenCalled();
    });

    it("should throw error if tenant record deletion fails", async () => {
      const tenantId = "tenant-123";
      const mockTenant = {
        id: tenantId,
        shortName: "test-clinic",
        longName: "Test Clinic",
        databaseUrl: "postgresql://user:pass@localhost:5432/test-clinic",
      };

      const mockConfig = { setConfig: vi.fn() };

      const mockSelectBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([mockTenant]),
      };

      const mockUpdateBuilder = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([]),
      };

      const mockDeleteBuilder = {
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([]),
      };

      const mockDeleteTenantBuilder = {
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([]), // Empty result = tenant not found
      };

      mockTenantConfig.create.mockResolvedValue(mockConfig);
      mockCentralDb.select.mockReturnValue(mockSelectBuilder);
      mockCentralDb.update.mockReturnValue(mockUpdateBuilder);
      mockCentralDb.delete
        .mockReturnValueOnce(mockDeleteBuilder) // users
        .mockReturnValueOnce(mockDeleteBuilder) // configs
        .mockReturnValueOnce(mockDeleteTenantBuilder); // tenant

      mockTenantMigrationService.parseDatabaseUrl.mockReturnValue({
        host: "localhost",
        port: 5432,
        database: "test-clinic",
        username: "user",
        password: "pass",
      });

      // Mock successful database operations
      const mockAdminClient = {
        unsafe: vi.fn().mockResolvedValue([]),
        end: vi.fn().mockResolvedValue(undefined),
      };

      vi.doMock("postgres", () => ({
        default: vi.fn(() => mockAdminClient),
      }));

      const service = await TenantAdminService.getTenantById(tenantId);
      (service as any)["#tenant"] = mockTenant;

      await expect(service.deleteTenant()).rejects.toThrow("Tenant with ID tenant-123 not found");
    });
  });
});
