const { MarzbanService } = require('../../src/services/marzban.service');
const assert = require('assert');
const { describe, it, beforeEach, afterEach } = require('node:test');
const axios = require('axios');

describe('MarzbanService Performance Optimization', () => {
  const originalPost = axios.post;

  beforeEach(() => {
    // Restore axios.post before each test
    axios.post = originalPost;
  });

  afterEach(() => {
    // Restore axios.post after each test
    axios.post = originalPost;
  });
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

  it('should construct valid URL for refreshToken', async () => {
    const service = new MarzbanService(mockConfig);

    // Mock axios.post to inspect arguments
    let capturedUrl = '';
    axios.post = async (url) => {
      capturedUrl = url;
      return { data: { access_token: 'new_token' } };
    };

    // Need to mock prisma update
    const prisma = require('../../src/utils/prisma');
    const originalUpdate = prisma.marzbanConfig.update;
    prisma.marzbanConfig.update = async () => {};

    try {
      await service.refreshToken();

      assert.strictEqual(capturedUrl, 'https://example.com/api/admin/token');
    } finally {
      prisma.marzbanConfig.update = originalUpdate;
    }
  });

  it('should throw error for invalid base URL in refreshToken', async () => {
     // Create service with invalid URL structure (though constructor cleans it, let's assume it breaks URL parsing somehow)
     // Actually MarzbanService doesn't validate in constructor strictly for format, just regex replace.
     // But new URL() will throw if invalid protocol.

     const invalidConfig = { ...mockConfig, endpointUrl: 'invalid-url' };
     // This might throw in refreshToken when `new URL(invalid-url)` is called.

     const service = new MarzbanService(invalidConfig);

     await assert.rejects(async () => {
       await service.refreshToken();
     }, {
       message: /Invalid URL/
     });
  });
});
