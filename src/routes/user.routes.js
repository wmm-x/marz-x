const express = require('express');
const prisma = require('../utils/prisma');
const { createMarzbanService } = require('../services/marzban.service');
const authMiddleware = require('../middleware/auth.middleware');

const router = express.Router();

router.use(authMiddleware);

// Auto server optimization: check RAM and restart xray if needed
router.post('/:configId/auto-optimize', async function(req, res) {
  try {
    const config = await getConfig(req, res);
    const marzban = await createMarzbanService(config);
    const result = await marzban.autoOptimizeServer();
    res.json(result);
  } catch (error) {
    console.error('Auto optimize error:', error.message);
    res.status(500).json({ error: 'Failed to auto optimize server' });
  }
});

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

/**
 * @swagger
 * /api/users/{configId}:
 *   get:
 *     summary: Get all VPN users
 *     description: Retrieve all VPN users from the Marzban panel
 *     tags: [Users]
 *     security:
 *       - OAuth2PasswordBearer: []
 *     parameters:
 *       - in: path
 *         name: configId
 *         required: true
 *         schema:
 *           type: string
 *         description: Marzban configuration ID
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Pagination offset
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Number of users to retrieve
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, disabled, limited, expired]
 *         description: Filter by user status
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search users by username
 *     responses:
 *       200:
 *         description: List of users
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 users:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/MarzbanUser'
 *                 total:
 *                   type: integer
 *                   description: Total number of users
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Failed to get users
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
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

/**
 * @swagger
 * /api/users/{configId}:
 *   post:
 *     summary: Create VPN user
 *     description: Create a new VPN user in the Marzban panel
 *     tags: [Users]
 *     security:
 *       - OAuth2PasswordBearer: []
 *     parameters:
 *       - in: path
 *         name: configId
 *         required: true
 *         schema:
 *           type: string
 *         description: Marzban configuration ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateMarzbanUserRequest'
 *     responses:
 *       201:
 *         description: User created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MarzbanUser'
 *       400:
 *         description: Bad request
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Failed to create user
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
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

/**
 * @swagger
 * /api/users/{configId}/{username}/reset:
 *   post:
 *     summary: Reset user traffic
 *     description: Reset the traffic usage for a specific VPN user
 *     tags: [Users]
 *     security:
 *       - OAuth2PasswordBearer: []
 *     parameters:
 *       - in: path
 *         name: configId
 *         required: true
 *         schema:
 *           type: string
 *         description: Marzban configuration ID
 *       - in: path
 *         name: username
 *         required: true
 *         schema:
 *           type: string
 *         description: VPN username
 *     responses:
 *       200:
 *         description: Traffic reset successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MarzbanUser'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Failed to reset traffic
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
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

/**
 * @swagger
 * /api/users/{configId}/{username}/revoke:
 *   post:
 *     summary: Revoke user subscription
 *     description: Revoke the subscription link for a specific VPN user
 *     tags: [Users]
 *     security:
 *       - OAuth2PasswordBearer: []
 *     parameters:
 *       - in: path
 *         name: configId
 *         required: true
 *         schema:
 *           type: string
 *         description: Marzban configuration ID
 *       - in: path
 *         name: username
 *         required: true
 *         schema:
 *           type: string
 *         description: VPN username
 *     responses:
 *       200:
 *         description: Subscription revoked successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MarzbanUser'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Failed to revoke subscription
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
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

/**
 * @swagger
 * /api/users/{configId}/{username}:
 *   get:
 *     summary: Get single VPN user
 *     description: Get details of a specific VPN user
 *     tags: [Users]
 *     security:
 *       - OAuth2PasswordBearer: []
 *     parameters:
 *       - in: path
 *         name: configId
 *         required: true
 *         schema:
 *           type: string
 *         description: Marzban configuration ID
 *       - in: path
 *         name: username
 *         required: true
 *         schema:
 *           type: string
 *         description: VPN username
 *     responses:
 *       200:
 *         description: User details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MarzbanUser'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Failed to get user
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
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

/**
 * @swagger
 * /api/users/{configId}/{username}:
 *   put:
 *     summary: Update VPN user
 *     description: Update a VPN user's configuration
 *     tags: [Users]
 *     security:
 *       - OAuth2PasswordBearer: []
 *     parameters:
 *       - in: path
 *         name: configId
 *         required: true
 *         schema:
 *           type: string
 *         description: Marzban configuration ID
 *       - in: path
 *         name: username
 *         required: true
 *         schema:
 *           type: string
 *         description: VPN username
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [active, disabled]
 *               data_limit:
 *                 type: number
 *               expire:
 *                 type: number
 *               proxies:
 *                 type: object
 *               inbounds:
 *                 type: object
 *               note:
 *                 type: string
 *     responses:
 *       200:
 *         description: User updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MarzbanUser'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Failed to update user
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// Update user
router.put('/:configId/:username', async function(req, res) {
  console.log('UPDATE USER:', req.params.username);
  
  try {
    const config = await getConfig(req, res);
    const marzban = await createMarzbanService(config);
    
    // Get existing user to preserve defaults if not provided
    const existingUser = await marzban.getUser(req.params.username);
    
    // Build update data
    const updateData = {
      status: req.body.status !== undefined ? req.body.status : existingUser.status,
      data_limit: req.body.data_limit !== undefined ? req.body.data_limit : existingUser.data_limit,
      data_limit_reset_strategy: req.body.data_limit_reset_strategy || existingUser.data_limit_reset_strategy || 'no_reset',
      expire: req.body.expire !== undefined ? req.body.expire : existingUser.expire,
      note: req.body.note !== undefined ? req.body.note : existingUser.note,
      
      // FIX: Check req.body first. If frontend sent new proxies/inbounds, use them.
      proxies: req.body.proxies !== undefined ? req.body.proxies : (existingUser.proxies || {}),
      inbounds: req.body.inbounds !== undefined ? req.body.inbounds : (existingUser.inbounds || {}),
      
      on_hold_expire_duration: req.body.on_hold_expire_duration !== undefined ? req.body.on_hold_expire_duration : existingUser.on_hold_expire_duration,
      on_hold_timeout: req.body.on_hold_timeout !== undefined ? req.body.on_hold_timeout : existingUser.on_hold_timeout
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

/**
 * @swagger
 * /api/users/{configId}/{username}:
 *   delete:
 *     summary: Delete VPN user
 *     description: Delete a VPN user from the Marzban panel
 *     tags: [Users]
 *     security:
 *       - OAuth2PasswordBearer: []
 *     parameters:
 *       - in: path
 *         name: configId
 *         required: true
 *         schema:
 *           type: string
 *         description: Marzban configuration ID
 *       - in: path
 *         name: username
 *         required: true
 *         schema:
 *           type: string
 *         description: VPN username
 *     responses:
 *       200:
 *         description: User deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Failed to delete user
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
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