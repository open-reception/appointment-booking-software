import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the database module
vi.mock('../db', () => ({
	centralDb: {
		insert: vi.fn(),
		select: vi.fn(),
		update: vi.fn(),
		delete: vi.fn()
	},
	getTenantDb: vi.fn()
}));

// Mock TenantConfig
vi.mock('../db/tenant-config', () => ({
	TenantConfig: {
		create: vi.fn()
	}
}));

// Mock environment variables
vi.mock('$env/dynamic/private', () => ({
	env: {
		DATABASE_URL: 'postgresql://user:pass@localhost:5432/central_db'
	}
}));

describe('TenantAdminService', () => {
	let TenantAdminService: any;
	let mockCentralDb: any;
	let mockGetTenantDb: any;
	let mockTenantConfig: any;

	beforeEach(async () => {
		vi.clearAllMocks();

		// Import the service after mocks are set up
		TenantAdminService = (await import('./tenant-admin-service')).TenantAdminService;
		
		// Get mocked modules
		const dbModule = await vi.importMock('../db');
		mockCentralDb = dbModule.centralDb;
		mockGetTenantDb = dbModule.getTenantDb;
		
		const configModule = await vi.importMock('../db/tenant-config');
		mockTenantConfig = configModule.TenantConfig;
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('createTenant', () => {
		it('should create a new tenant with default configuration', async () => {
			const newTenant = {
				shortName: 'test-clinic',
				longName: 'Test Medical Clinic',
				description: 'A test clinic'
			};

			const mockCreatedTenant = {
				id: 'tenant-123',
				...newTenant,
				databaseUrl: 'postgresql://user:pass@localhost:5432/test-clinic'
			};

			const mockConfig = {
				setConfig: vi.fn()
			};

			const mockInsertBuilder = {
				values: vi.fn().mockReturnThis(),
				returning: vi.fn().mockResolvedValue([mockCreatedTenant])
			};

			mockCentralDb.insert.mockReturnValue(mockInsertBuilder);
			mockTenantConfig.create.mockResolvedValue(mockConfig);

			const result = await TenantAdminService.createTenant(newTenant);

			expect(mockCentralDb.insert).toHaveBeenCalled();
			expect(mockInsertBuilder.values).toHaveBeenCalledWith({
				...newTenant,
				databaseUrl: 'postgresql://user:pass@localhost:5432/test-clinic'
			});
			expect(mockTenantConfig.create).toHaveBeenCalledWith('tenant-123');
			expect(mockConfig.setConfig).toHaveBeenCalledWith('brandColor', '#E11E15');
			expect(result).toBeInstanceOf(TenantAdminService);
		});
	});

	describe('getTenantById', () => {
		it('should get tenant by ID and initialize configuration', async () => {
			const tenantId = 'tenant-123';
			const mockConfig = {
				setConfig: vi.fn(),
				getConfig: vi.fn()
			};

			mockTenantConfig.create.mockResolvedValue(mockConfig);

			const result = await TenantAdminService.getTenantById(tenantId);

			expect(mockTenantConfig.create).toHaveBeenCalledWith(tenantId);
			expect(result).toBeInstanceOf(TenantAdminService);
			expect(result.tenantId).toBe(tenantId);
		});
	});

	describe('update', () => {
		it('should update tenant data', async () => {
			const tenantId = 'tenant-123';
			const updateData = {
				longName: 'Updated Clinic Name',
				description: 'Updated description'
			};

			const mockConfig = { setConfig: vi.fn() };
			const mockUpdateBuilder = {
				set: vi.fn().mockReturnThis(),
				where: vi.fn().mockReturnThis()
			};

			mockTenantConfig.create.mockResolvedValue(mockConfig);
			mockCentralDb.update.mockReturnValue(mockUpdateBuilder);

			const service = await TenantAdminService.getTenantById(tenantId);
			await service.update(updateData);

			expect(mockCentralDb.update).toHaveBeenCalled();
			expect(mockUpdateBuilder.set).toHaveBeenCalledWith(updateData);
			expect(mockUpdateBuilder.where).toHaveBeenCalled();
		});
	});

	describe('getDb', () => {
		it('should return database connection', async () => {
			const tenantId = 'tenant-123';
			const mockConfig = { setConfig: vi.fn() };
			const mockTenantDb = {
				select: vi.fn(),
				insert: vi.fn(),
				update: vi.fn()
			};

			mockTenantConfig.create.mockResolvedValue(mockConfig);
			mockGetTenantDb.mockResolvedValue(mockTenantDb);

			const service = await TenantAdminService.getTenantById(tenantId);
			const db = await service.getDb();

			expect(mockGetTenantDb).toHaveBeenCalledWith(tenantId);
			expect(db).toBe(mockTenantDb);
		});

		it('should cache database connection', async () => {
			const tenantId = 'tenant-123';
			const mockConfig = { setConfig: vi.fn() };
			const mockTenantDb = { select: vi.fn() };

			mockTenantConfig.create.mockResolvedValue(mockConfig);
			mockGetTenantDb.mockResolvedValue(mockTenantDb);

			const service = await TenantAdminService.getTenantById(tenantId);
			
			// First call
			await service.getDb();
			// Second call should use cache
			await service.getDb();

			expect(mockGetTenantDb).toHaveBeenCalledTimes(1);
		});
	});

	describe('configuration', () => {
		it('should provide access to tenant configuration', async () => {
			const tenantId = 'tenant-123';
			const mockConfig = {
				setConfig: vi.fn(),
				getConfig: vi.fn().mockReturnValue('test-value')
			};

			mockTenantConfig.create.mockResolvedValue(mockConfig);

			const service = await TenantAdminService.getTenantById(tenantId);
			const config = service.configuration;

			expect(config).toBe(mockConfig);
		});
	});
});