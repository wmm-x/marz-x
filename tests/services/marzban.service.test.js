const { MarzbanService } = require('../../src/services/marzban.service');
const assert = require('assert');
const { describe, it } = require('node:test');

describe('MarzbanService Performance Optimization', () => {
  const mockConfig = {
    endpointUrl: 'https://example.com',
    encryptedAccessToken: 'token',
    marzbanUsername: 'admin',
    encryptedPassword: 'password'
  };

  it('should use provided stats in autoOptimizeServer and avoid extra API call', async () => {
    const service = new MarzbanService(mockConfig);

    // Mock getSystemStats to verify it's NOT called
    let getSystemStatsCalled = false;
    service.getSystemStats = async () => {
      getSystemStatsCalled = true;
      return { mem_used: 50, mem_total: 100 };
    };

    // Mock restartXray to avoid actual calls
    service.restartXray = async () => {
      return { status: 'restarted' };
    };

    const stats = { mem_used: 20, mem_total: 100 };

    // Call with stats
    await service.autoOptimizeServer(stats);

    assert.strictEqual(getSystemStatsCalled, false, 'getSystemStats should NOT be called when stats are provided');
  });

  it('should call getSystemStats in autoOptimizeServer if stats are NOT provided', async () => {
    const service = new MarzbanService(mockConfig);

    // Mock getSystemStats to verify it IS called
    let getSystemStatsCalled = false;
    service.getSystemStats = async () => {
      getSystemStatsCalled = true;
      return { mem_used: 50, mem_total: 100 };
    };

    // Mock restartXray
    service.restartXray = async () => {
      return { status: 'restarted' };
    };

    // Call without stats
    await service.autoOptimizeServer();

    assert.strictEqual(getSystemStatsCalled, true, 'getSystemStats SHOULD be called when stats are NOT provided');
  });
});
