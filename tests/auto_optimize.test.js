
const { test, describe, it, beforeEach, mock } = require('node:test');
const assert = require('node:assert');
const { MarzbanService } = require('../src/services/marzban.service');

// Mock axios to prevent actual network calls during test setup
const axios = require('axios');
axios.create = mock.fn(() => ({
  interceptors: {
    response: { use: () => {} }
  },
  get: mock.fn(),
  post: mock.fn()
}));

describe('MarzbanService.autoOptimizeServer', () => {
  let service;
  const mockConfig = {
    endpointUrl: 'http://example.com',
    encryptedAccessToken: 'token123',
    marzbanUsername: 'admin',
    encryptedPassword: 'password'
  };

  beforeEach(() => {
    service = new MarzbanService(mockConfig);
    // Mock getSystemStats specifically on the instance
    service.getSystemStats = mock.fn(async () => ({
      mem_used: 100,
      mem_total: 1000
    }));
    // Mock restartXray
    service.restartXray = mock.fn(async () => ({ success: true }));
  });

  it('should call getSystemStats when no stats are provided', async () => {
    await service.autoOptimizeServer();
    assert.strictEqual(service.getSystemStats.mock.calls.length, 1);
  });

  it('should NOT call getSystemStats when stats are provided (OPTIMIZATION)', async () => {
    const stats = { mem_used: 200, mem_total: 1000 };
    await service.autoOptimizeServer(stats);

    // In the current implementation, this will fail because it ignores the argument
    // and calls getSystemStats anyway.
    assert.strictEqual(service.getSystemStats.mock.calls.length, 0, 'getSystemStats should not be called if stats provided');
  });
});
