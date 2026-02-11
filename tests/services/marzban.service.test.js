const { test, describe } = require('node:test');
const assert = require('node:assert');
const { MarzbanService } = require('../../src/services/marzban.service');

// Simple reproduction test
// This will confirm if getSystemStats is called redundantly

test('MarzbanService.autoOptimizeServer', async (t) => {
    // Mock class for testing
    // We can't easily mock the module-level 'axios' or 'prisma' directly without proxying imports,
    // but we can subclass or mock the service methods we care about.

    // Mock config
    const mockConfig = {
        id: 1,
        endpointUrl: 'http://example.com',
        encryptedAccessToken: 'token',
        marzbanUsername: 'admin',
        encryptedPassword: 'password'
    };

    // Instantiate service
    const service = new MarzbanService(mockConfig);

    // Mock dependencies we don't want to actually run
    service.createClient = () => ({ // overwrite instance method or just rely on constructor call being done
        get: async () => ({ data: {} }),
        post: async () => ({ data: {} }),
        interceptors: { response: { use: () => {} } }
    });
    // Re-create client to apply mocks if needed, but constructor already ran.
    // The constructor calls createClient internally. We can just mock the client property.
    service.client = {
        get: async () => ({ data: {} }),
        post: async () => ({ data: {} }),
        interceptors: { response: { use: () => {} } }
    };

    await t.test('calls getSystemStats when no stats provided (default behavior)', async () => {
        let calls = 0;
        // Mock getSystemStats on the instance
        service.getSystemStats = async () => {
            calls++;
            return { mem_used: 100, mem_total: 1000 };
        };

        await service.autoOptimizeServer();
        assert.strictEqual(calls, 1, 'Should call getSystemStats once');
    });

    await t.test('calls getSystemStats when stats provided (redundant behavior)', async () => {
        let calls = 0;
        service.getSystemStats = async () => {
            calls++;
            return { mem_used: 100, mem_total: 1000 };
        };

        const existingStats = { mem_used: 100, mem_total: 1000 };
        await service.autoOptimizeServer(existingStats);

        // CURRENTLY: This will likely be 1 because the optimization isn't implemented.
        // We assert 0 to prove the "bug" (or lack of optimization)
        // If this test fails (calls === 1), then we have reproduced the issue.
        assert.strictEqual(calls, 0, 'Should NOT call getSystemStats if stats provided');
    });
});
