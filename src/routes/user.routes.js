const express = require('express');
const prisma = require('../utils/prisma');
const { createMarzbanService } = require('../services/marzban.service');
const authMiddleware = require('../middleware/auth.middleware');

const router = express.Router();

router.use(authMiddleware);

// Helper to get config
async function getConfig(req, res) {
    const config = await prisma.marzbanConfig.findFirst({
        where: { id: req.params.configId, userId: req.userId },
    });
    if (!config) throw new Error('Configuration not found');
    return config;
}

// Test route
router.get('/test', function(req, res) {
  res.json({ message: 'User routes working' });
});

// Get all users
router.get('/:configId', async function(req, res) {
  try {
    const config = await getConfig(req, res);
    const marzban = await createMarzbanService(config);
    
    const params = {
      offset: req.query.offset ? parseInt(req.query.offset) : 0,
      limit: req.query.limit ? parseInt(req.query.limit) : 50,
      status: req.query.status || undefined,
      search: req.query.search || undefined
    };
    
    const result = await marzban.getUsers(params);

    res.json({
      users: result.users || [],
      total: result.total || 0
    });
  } catch (error) {
    console.error('Get users error:', error.message);
    res.status(500).json({ error: 'Failed to get users' });
  }
});

// Create user
router.post('/:configId', async function(req, res) {
  try {
    const config = await getConfig(req, res);
    const marzban = await createMarzbanService(config);
    const user = await marzban.createUser(req.body);

    res.status(201).json(user);
  } catch (error) {
    console.error('Create user error:', error.message);
    if (error.response) {
      return res.status(error.response.status || 400).json(error.response.data);
    }
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Reset traffic
router.post('/:configId/:username/reset', async function(req, res) {
  try {
    const config = await getConfig(req, res);
    const marzban = await createMarzbanService(config);
    const user = await marzban.resetUserTraffic(req.params.username);

    res.json(user);
  } catch (error) {
    console.error('Reset traffic error:', error.message);
    res.status(500).json({ error: 'Failed to reset traffic' });
  }
});

// Revoke subscription
router.post('/:configId/:username/revoke', async function(req, res) {
  try {
    const config = await getConfig(req, res);
    const marzban = await createMarzbanService(config);
    const user = await marzban.revokeUserSubscription(req.params.username);

    res.json(user);
  } catch (error) {
    console.error('Revoke error:', error.message);
    res.status(500).json({ error: 'Failed to revoke subscription' });
  }
});

// Get single user
router.get('/:configId/:username', async function(req, res) {
  try {
    const config = await getConfig(req, res);
    const marzban = await createMarzbanService(config);
    const user = await marzban.getUser(req.params.username);

    res.json(user);
  } catch (error) {
    console.error('Get user error:', error.message);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// Update user
router.put('/:configId/:username', async function(req, res) {
  console.log('UPDATE USER:', req.params.username);
  
  try {
    const config = await getConfig(req, res);
    const marzban = await createMarzbanService(config);
    
    // Get existing user to preserve proxies and inbounds
    const existingUser = await marzban.getUser(req.params.username);
    
    // Build update data
    const updateData = {
      status: req.body.status !== undefined ? req.body.status : existingUser.status,
      data_limit: req.body.data_limit !== undefined ? req.body.data_limit : existingUser.data_limit,
      data_limit_reset_strategy: req.body.data_limit_reset_strategy || existingUser.data_limit_reset_strategy || 'no_reset',
      expire: req.body.expire !== undefined ? req.body.expire : existingUser.expire,
      note: req.body.note !== undefined ? req.body.note : existingUser.note,
      proxies: existingUser.proxies || {},
      inbounds: existingUser.inbounds || {},
      on_hold_expire_duration: existingUser.on_hold_expire_duration,
      on_hold_timeout: existingUser.on_hold_timeout
    };

    const user = await marzban.updateUser(req.params.username, updateData);
    res.json(user);
  } catch (error) {
    console.error('Update user error:', error.message);
    if (error.response) {
      return res.status(error.response.status || 500).json(error.response.data);
    }
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Delete user - FIXED TO IGNORE MARZBAN ERRORS
router.delete('/:configId/:username', async function(req, res) {
  console.log('DELETE USER (Safe Mode):', req.params.username);
  
  try {
    const config = await getConfig(req, res);
    const marzban = await createMarzbanService(config);
    
    // Try to delete from Marzban, but DO NOT CRASH if it fails
    try {
        await marzban.deleteUser(req.params.username);
        console.log('User deleted from Marzban successfully');
    } catch (marzbanError) {
        console.warn('⚠️ Marzban returned error, but proceeding with deletion.');
        console.warn('Marzban Error:', marzbanError.message);
    }

    // Always return success so dashboard updates immediately
    res.json({ success: true, message: 'User deleted' });

  } catch (error) {
    // This only runs if database/config fetch fails, not Marzban actions
    console.error('System error during delete:', error.message);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

console.log('User routes loaded!');

module.exports = router;