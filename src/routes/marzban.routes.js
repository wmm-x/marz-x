const express = require('express');
const axios = require('axios');
const prisma = require('../utils/prisma');
const authMiddleware = require('../middleware/auth.middleware');
const { createMarzbanService } = require('../services/marzban.service');
const { validateUrl } = require('../utils/urlValidator');
const dns = require('dns').promises;
const net = require('net');

const router = express.Router();

/**
 * Check if the given hostname resolves to a private, loopback, link-local, or multicast address.
 * This is used as an additional safeguard against SSRF when using user-controlled endpoints.
 */
async function isPrivateOrLocalHost(hostname) {
  const lowered = (hostname || '').toLowerCase();

  // Explicit localhost-style hostnames
  if (
    lowered === 'localhost' ||
    lowered === '127.0.0.1' ||
    lowered === '::1'
  ) {
    return true;
  }

  let addresses = [];
  try {
    const result = await dns.lookup(hostname, { all: true });
    addresses = result.map(r => r.address);
  } catch (e) {
    // If hostname cannot be resolved, treat it as invalid for our purposes.
    return true;
  }

  function isPrivateIp(ip) {
    const version = net.isIP(ip);
    if (!version) {
      return true;
    }

    if (version === 4) {
      const parts = ip.split('.').map(n => parseInt(n, 10));
      const [a, b] = parts;

      // 10.0.0.0/8
      if (a === 10) return true;
      // 172.16.0.0/12
      if (a === 172 && b >= 16 && b <= 31) return true;
      // 192.168.0.0/16
      if (a === 192 && b === 168) return true;
      // 127.0.0.0/8 (loopback)
      if (a === 127) return true;
      // 169.254.0.0/16 (link-local)
      if (a === 169 && b === 254) return true;
      // 0.0.0.0/8, 224.0.0.0/4 and above (multicast / reserved)
      if (a === 0 || a >= 224) return true;

      return false;
    }

    // IPv6: treat link-local, loopback, and unique local as private
    const normalized = ip.toLowerCase();
    if (
      normalized === '::1' ||          // loopback
      normalized.startsWith('fe80:') || // link-local
      normalized.startsWith('fc00:') || // unique local
      normalized.startsWith('fd00:')    // unique local
    ) {
      return true;
    }

    return false;
  }

  return addresses.some(isPrivateIp);
}

// Connect to Marzban (create new config)
router.post('/connect', authMiddleware, async function(req, res) {
  try {
    var name = req.body.name;
    var endpointUrl = req.body. endpointUrl;
    var username = req.body.username;
    var password = req.body. password;
    
    // Validate URL to prevent SSRF attacks
    const urlValidation = validateUrl(endpointUrl);
    if (!urlValidation.valid) {
      return res.status(400).json({ error: urlValidation.error });
    }
    
    endpointUrl = endpointUrl.replace(/\/+$/, '');
    
    var params = new URLSearchParams();
    params.append('username', username);
    params.append('password', password);
    
    var authRes = await axios. post(endpointUrl + '/api/admin/token', params, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 10000,
      maxRedirects: 0  // Prevent redirect-based SSRF attacks
    });
    
    if (! authRes.data || !authRes.data.access_token) {
      return res.status(400).json({ error: 'Failed to authenticate with Marzban' });
    }
    
    var config = await prisma.marzbanConfig.create({
      data: {
        name: name,
        endpointUrl: endpointUrl,
        marzbanUsername: username,
        encryptedPassword:  password,
        encryptedAccessToken: authRes. data.access_token,
        userId: req.userId
      }
    });
    
    res.status(201).json({ 
      config: { id: config.id, name: config.name, endpointUrl: config.endpointUrl } 
    });
  } catch (error) {
    console.error('Connect error:', error.message);
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      return res.status(400).json({ error: 'Cannot connect to Marzban server' });
    }
    res.status(500).json({ error: 'Failed to connect to server' });
  }
});

// Get all configs
router.get('/configs', authMiddleware, async function(req, res) {
  try {
    var configs = await prisma.marzbanConfig.findMany({
      where: { userId: req.userId },
      select: { id: true, name: true, endpointUrl: true, createdAt: true }
    });
    res.json({ configs:  configs });
  } catch (error) {
    console.error('Get configs error:', error);
    res.status(500).json({ error: 'Failed to get configurations' });
  }
});

// Update config
router.put('/configs/:id', authMiddleware, async function(req, res) {
  console.log('=== UPDATE CONFIG ===');
  console.log('Config ID:', req.params.id);
  
  try {
    var configId = req.params.id;
    var userId = req.userId;
    
    var existingConfig = await prisma.marzbanConfig.findFirst({
      where: { id: configId, userId: userId }
    });
    
    if (!existingConfig) {
      return res. status(404).json({ error: 'Configuration not found' });
    }
    
    var updateData = {};
    
    if (req.body.name && req.body.name. trim()) {
      updateData.name = req.body.name.trim();
    }
    
    if (req.body.endpointUrl && req.body.endpointUrl.trim()) {
      // Validate URL to prevent SSRF attacks
      const urlValidation = validateUrl(req.body.endpointUrl.trim());
      if (!urlValidation.valid) {
        return res.status(400).json({ error: urlValidation.error });
      }
      updateData.endpointUrl = req.body.endpointUrl.trim().replace(/\/+$/, '');
    }
    
    if (req.body.username && req.body.username.trim() && req.body.password) {
      try {
        var params = new URLSearchParams();
        params.append('username', req. body.username.trim());
        params.append('password', req. body.password);
        
        var endpointUrl = updateData.endpointUrl || existingConfig. endpointUrl;
        
        // Validate the endpoint URL before using it (even if it's from existing config)
        const urlValidation = validateUrl(endpointUrl);
        if (!urlValidation.valid) {
          return res.status(400).json({ error: 'Invalid endpoint URL: ' + urlValidation.error });
        }


        // Additional SSRF protection: disallow localhost/private/internal endpoints
        const isPrivate = await isPrivateOrLocalHost(parsedEndpoint.hostname);
        if (isPrivate) {
          return res.status(400).json({ error: 'Endpoint URL host is not allowed' });
        }

        // Normalize the endpoint URL and ensure that only the origin is used,
        // so any user-controlled path/query/fragment is ignored when building the request URL.
        const parsedEndpoint = new URL(endpointUrl);
        const finalUrl = parsedEndpoint.origin + '/api/admin/token';
        
        var authRes = await axios. post(finalUrl, params, {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          timeout: 10000,
          maxRedirects: 0  // Prevent redirect-based SSRF attacks
        });
        
        if (authRes.data && authRes. data.access_token) {
          updateData.marzbanUsername = req.body. username.trim();
          updateData.encryptedPassword = req. body.password;
          updateData.encryptedAccessToken = authRes.data.access_token;
        }
      } catch (authError) {
        console.error('Re-auth failed:', authError.message);
        return res.status(400).json({ error: 'Failed to authenticate with new credentials' });
      }
    }
    
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'No changes provided' });
    }
    
    var updatedConfig = await prisma.marzbanConfig.update({
      where: { id:  configId },
      data: updateData
    });
    
    console.log('Config updated successfully');
    
    res.json({ 
      config: { 
        id: updatedConfig. id, 
        name: updatedConfig.name, 
        endpointUrl: updatedConfig.endpointUrl 
      }
    });
  } catch (error) {
    console.error('Update config error:', error);
    res.status(500).json({ error: 'Failed to update server' });
  }
});

// Delete config
router.delete('/configs/:id', authMiddleware, async function(req, res) {
  try {
    var configId = req.params.id;
    
    var config = await prisma.marzbanConfig.findFirst({
      where: { id: configId, userId: req.userId }
    });
    
    if (!config) {
      return res.status(404).json({ error: 'Configuration not found' });
    }
    
    await prisma. marzbanConfig.delete({ where: { id: configId } });
    
    res.json({ message: 'Server removed successfully' });
  } catch (error) {
    console.error('Delete config error:', error);
    res.status(500).json({ error: 'Failed to delete server' });
  }
});

// Helper function to get config with all fields
async function getFullConfig(configId, userId) {
  return await prisma.marzbanConfig.findFirst({
    where: { id: configId, userId:  userId }
  });
}

// Get system stats
router.get('/configs/:id/system', authMiddleware, async function(req, res) {
  try {
    var config = await getFullConfig(req. params.id, req.userId);
    
    if (!config) {
      return res.status(404).json({ error: 'Configuration not found' });
    }
    
    var marzban = await createMarzbanService(config);
    var stats = await marzban.getSystemStats();
    
    res.json(stats);
  } catch (error) {
    console.error('Get system stats error:', error. message);
    res.status(500).json({ error: 'Failed to get system stats' });
  }
});

// Get inbounds
router. get('/configs/:id/inbounds', authMiddleware, async function(req, res) {
  try {
    var config = await getFullConfig(req.params. id, req.userId);
    
    if (!config) {
      return res.status(404).json({ error: 'Configuration not found' });
    }
    
    var marzban = await createMarzbanService(config);
    var inbounds = await marzban.getInbounds();
    
    res.json(inbounds);
  } catch (error) {
    console.error('Get inbounds error:', error.message);
    res.status(500).json({ error: 'Failed to get inbounds' });
  }
});

// Get nodes
router.get('/configs/:id/nodes', authMiddleware, async function(req, res) {
  try {
    var config = await getFullConfig(req.params.id, req.userId);
    
    if (!config) {
      return res.status(404).json({ error: 'Configuration not found' });
    }
    
    var marzban = await createMarzbanService(config);
    var nodes = await marzban.getNodes();
    
    res.json(nodes);
  } catch (error) {
    console.error('Get nodes error:', error. message);
    res.status(500).json({ error: 'Failed to get nodes' });
  }
});

// Get core config
router.get('/configs/:id/core-config', authMiddleware, async function(req, res) {
  try {
    var config = await getFullConfig(req.params. id, req.userId);
    
    if (!config) {
      return res.status(404).json({ error: 'Configuration not found' });
    }
    
    var marzban = await createMarzbanService(config);
    var coreConfig = await marzban.getCoreConfig();
    
    res.json(coreConfig);
  } catch (error) {
    console.error('Get core config error:', error.message);
    res.status(500).json({ error: 'Failed to get core config' });
  }
});

// Update core config
router.put('/configs/:id/core-config', authMiddleware, async function(req, res) {
  try {
    var config = await getFullConfig(req.params.id, req.userId);
    
    if (!config) {
      return res.status(404).json({ error: 'Configuration not found' });
    }
    
    var marzban = await createMarzbanService(config);
    var result = await marzban.updateCoreConfig(req.body);
    
    res.json(result);
  } catch (error) {
    console.error('Update core config error:', error.message);
    var msg = 'Failed to update core config';
    if (error.response && error.response.data) {
      msg = error.response.data.detail || error.response.data.message || msg;
    }
    res.status(500).json({ error: msg });
  }
});
router.get('/configs/:id/nodes-usage', authMiddleware, async function(req, res) {
  try {
    // Reuse the helper function if available, or fetch manually
    var config = await prisma.marzbanConfig.findFirst({
      where: { id: req.params.id, userId: req.userId }
    });
    
    if (!config) {
      return res.status(404).json({ error: 'Configuration not found' });
    }
    
    var marzban = await createMarzbanService(config);
    // Pass start/end query params from frontend to the service
    var usage = await marzban.getNodesUsage(req.query.start, req.query.end);
    
    res.json(usage);
  } catch (error) {
    console.error('Get nodes usage error:', error.message);
    res.status(500).json({ error: 'Failed to get nodes usage' });
  }
});

// Restart Xray
router.post('/configs/:id/restart-xray', authMiddleware, async function(req, res) {
  try {
    var config = await getFullConfig(req.params.id, req.userId);
    
    if (!config) {
      return res.status(404).json({ error: 'Configuration not found' });
    }
    
    var marzban = await createMarzbanService(config);
    await marzban.restartXray();
    
    res.json({ message: 'Xray restarted successfully' });
  } catch (error) {
    console.error('Restart Xray error:', error.message);
    res.status(500).json({ error: 'Failed to restart Xray' });
  }
});

console.log('Marzban routes loaded! ');


// GET /api/marzban/configs/:id/hosts
router.get('/configs/:id/hosts', authMiddleware, async function(req, res) {
  try {
    var config = await prisma.marzbanConfig.findFirst({
      where: { id: req.params.id, userId: req.userId }
    });
    
    if (!config) {
      return res.status(404).json({ error: 'Configuration not found' });
    }

    // Connect to Marzban
    var marzban = await createMarzbanService(config);
    
    // Call the NEW getHosts method (hits /api/hosts on Marzban)
    var hosts = await marzban.getHosts();
    
    // Return the raw response from Marzban
    res.json(hosts);
    
  } catch (error) {
    console.error('Get hosts error:', error.message);
    // Handle case where Marzban doesn't have /api/hosts
    if (error.response && error.response.status === 404) {
      return res.status(404).json({ error: 'The /api/hosts endpoint does not exist on this Marzban server.' });
    }
    res.status(500).json({ error: 'Failed to get host configuration' });
  }
});

router.put('/configs/:id/hosts', authMiddleware, async function(req, res) {
  try {
    var config = await prisma.marzbanConfig.findFirst({
      where: { id: req.params.id, userId: req.userId }
    });
    
    if (!config) {
      return res.status(404).json({ error: 'Configuration not found' });
    }

    var marzban = await createMarzbanService(config);
    var result = await marzban.updateHosts(req.body);
    
    res.json(result);
  } catch (error) {
    console.error('Update hosts error:', error.message);
    res.status(500).json({ error: 'Failed to update hosts' });
  }
});

module.exports = router;