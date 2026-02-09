const assert = require('node:assert');
const { test } = require('node:test');
const { MarzbanService } = require('../src/services/marzban.service');

// Mock axios to avoid actual network calls
const axios = require('axios');
axios.create = () => ({
  interceptors: {
    response: { use: () => {} }
  },
  defaults: { headers: {} }
});

test('autoOptimizeServer uses provided stats to avoid redundant API call', async () => {
  // Mock config
  const config = { endpointUrl: 'http://example.com', encryptedAccessToken: 'token' };

  const service = new MarzbanService(config);

  // Track calls to getSystemStats
  let getSystemStatsCalled = 0;
  service.getSystemStats = async () => {
    getSystemStatsCalled++;
    return { mem_used: 10, mem_total: 100 }; // 10% usage
  };

  // Mock restartXray to avoid errors
  service.restartXray = async () => {};

  const fakeStats = { mem_used: 50, mem_total: 100 }; // 50% usage

  // Call autoOptimizeServer with stats
  // Before fix: stats argument is ignored, getSystemStats is called
  // After fix: stats argument is used, getSystemStats is NOT called
  await service.autoOptimizeServer(fakeStats);

  if (getSystemStatsCalled === 0) {
    console.log('PASS: getSystemStats was NOT called (Optimization present)');
  } else {
    console.error('FAIL: getSystemStats WAS called (Optimization missing)');
    throw new Error('Redundant API call detected');
  }
});