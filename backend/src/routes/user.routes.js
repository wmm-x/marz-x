const express = require('express');
const prisma = require('../utils/prisma');
const { createMarzbanService } = require('../services/marzban.service');
const authMiddleware = require('../middleware/auth.middleware');

const router = express.Router();

router.use(authMiddleware);

// Test route
router.get('/test', function(req, res) {
  res.json({ message: 'User routes working' });
});

// Get all users - GET /api/users/: configId
router.get('/:configId', async function(req, res) {
  console.log('GET USERS - configId:', req.params.configId);
  
  try {
    var config = await prisma.marzbanConfig. findFirst({
      where: { 
        id: req.params. configId, 
        userId:  req.userId 
      },
    });

    if (!config) {
      return res.status(404).json({ error: 'Configuration not found' });
    }

    var marzban = await createMarzbanService(config);
    
    var params = {
      offset: req.query.offset ?  parseInt(req.query.offset) : 0,
      limit:  req.query.limit ? parseInt(req.query.limit) : 50,
    };
    
    if (req.query.status && req.query.status !== '') {
      params.status = req.query.status;
    }
    
    if (req. query.search && req.query. search !== '') {
      params.search = req.query.search;
    }
    
    var result = await marzban.getUsers(params);

    res.json({
      users: result.users || [],
      total: result.total || 0
    });
  } catch (error) {
    console.error('Get users error:', error.message);
    res.status(500).json({ error: 'Failed to get users' });
  }
});

// Create user - POST /api/users/: configId
router.post('/:configId', async function(req, res) {
  console.log('CREATE USER - configId:', req.params.configId);
  
  try {
    var config = await prisma.marzbanConfig.findFirst({
      where: { id: req.params.configId, userId: req.userId },
    });

    if (!config) {
      return res.status(404).json({ error: 'Configuration not found' });
    }

    var marzban = await createMarzbanService(config);
    var user = await marzban.createUser(req.body);

    res.status(201).json(user);
  } catch (error) {
    console.error('Create user error:', error. message);
    if (error.response) {
      return res.status(error.response. status || 400).json(error.response.data);
    }
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Reset traffic - POST /api/users/: configId/: username/reset
// Must be before /:configId/:username routes
router.post('/:configId/:username/reset', async function(req, res) {
  console.log('RESET TRAFFIC - username:', req.params.username);
  
  try {
    var config = await prisma.marzbanConfig.findFirst({
      where: { id: req.params.configId, userId: req. userId },
    });

    if (!config) {
      return res.status(404).json({ error: 'Configuration not found' });
    }

    var marzban = await createMarzbanService(config);
    var user = await marzban.resetUserTraffic(req.params.username);

    res.json(user);
  } catch (error) {
    console.error('Reset traffic error:', error.message);
    res.status(500).json({ error: 'Failed to reset traffic' });
  }
});

// Revoke subscription - POST /api/users/:configId/: username/revoke
router.post('/:configId/:username/revoke', async function(req, res) {
  console.log('REVOKE SUB - username:', req.params. username);
  
  try {
    var config = await prisma.marzbanConfig.findFirst({
      where: { id:  req.params.configId, userId: req.userId },
    });

    if (!config) {
      return res.status(404).json({ error: 'Configuration not found' });
    }

    var marzban = await createMarzbanService(config);
    var user = await marzban. revokeUserSubscription(req.params.username);

    res.json(user);
  } catch (error) {
    console.error('Revoke error:', error.message);
    res.status(500).json({ error: 'Failed to revoke subscription' });
  }
});

// Get single user - GET /api/users/: configId/:username
router.get('/:configId/:username', async function(req, res) {
  console.log('GET USER - username:', req.params.username);
  
  try {
    var config = await prisma.marzbanConfig.findFirst({
      where: { id: req.params.configId, userId: req. userId },
    });

    if (!config) {
      return res.status(404).json({ error: 'Configuration not found' });
    }

    var marzban = await createMarzbanService(config);
    var user = await marzban.getUser(req.params.username);

    res.json(user);
  } catch (error) {
    console.error('Get user error:', error.message);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// Update user - PUT /api/users/: configId/:username
router.put('/:configId/:username', async function(req, res) {
  console.log('========================================');
  console.log('UPDATE USER');
  console.log('configId:', req.params. configId);
  console.log('username:', req.params.username);
  console.log('body:', JSON.stringify(req.body, null, 2));
  console.log('========================================');
  
  try {
    var config = await prisma.marzbanConfig.findFirst({
      where: { id: req.params.configId, userId: req.userId },
    });

    if (!config) {
      return res. status(404).json({ error: 'Configuration not found' });
    }

    var marzban = await createMarzbanService(config);
    
    // Get existing user to preserve proxies and inbounds
    var existingUser = await marzban.getUser(req. params.username);
    console.log('Existing user status:', existingUser.status);
    
    // Build update data
    var updateData = {
      status: req.body.status !== undefined ? req.body.status :  existingUser.status,
      data_limit: req.body. data_limit !== undefined ? req. body.data_limit : existingUser.data_limit,
      data_limit_reset_strategy:  req.body.data_limit_reset_strategy || existingUser. data_limit_reset_strategy || 'no_reset',
      expire: req.body.expire !== undefined ? req.body.expire :  existingUser.expire,
      note: req.body.note !== undefined ? req.body.note :  existingUser.note,
      proxies: existingUser.proxies || {},
      inbounds: existingUser.inbounds || {},
    };
    
    if (existingUser.on_hold_expire_duration !== undefined) {
      updateData.on_hold_expire_duration = existingUser.on_hold_expire_duration;
    }
    
    if (existingUser. on_hold_timeout) {
      updateData.on_hold_timeout = existingUser. on_hold_timeout;
    }

    console.log('Sending update:', JSON.stringify(updateData, null, 2));
    
    var user = await marzban. updateUser(req.params.username, updateData);
    console.log('User updated successfully');

    res.json(user);
  } catch (error) {
    console.error('Update user error:', error.message);
    if (error.response) {
      console.error('Marzban response:', error.response.data);
      return res.status(error. response.status || 500).json(error.response.data);
    }
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Delete user - DELETE /api/users/:configId/:username
router. delete('/:configId/:username', async function(req, res) {
  console.log('========================================');
  console.log('DELETE USER');
  console.log('configId:', req.params. configId);
  console.log('username:', req.params.username);
  console.log('========================================');
  
  try {
    var config = await prisma.marzbanConfig.findFirst({
      where: { id:  req.params.configId, userId: req.userId },
    });

    if (!config) {
      console.log('Config not found');
      return res.status(404).json({ error: 'Configuration not found' });
    }

    console.log('Config found:', config.name);

    var marzban = await createMarzbanService(config);
    
    console.log('Calling Marzban delete for:', req.params.username);
    await marzban.deleteUser(req.params.username);
    
    console.log('User deleted successfully');

    res.json({ success: true, message: 'User deleted' });
  } catch (error) {
    console.error('Delete user error:', error.message);
    if (error.response) {
      console.error('Marzban response:', error.response.data);
      return res.status(error.response.status || 500).json(error.response.data);
    }
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

console.log('User routes loaded! ');

module.exports = router;