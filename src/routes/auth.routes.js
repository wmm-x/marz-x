const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../utils/prisma');
const authMiddleware = require('../middleware/auth.middleware');
const { authRateLimiter } = require('../middleware/rateLimit.middleware');
const { exec } = require('child_process');
const fs = require('fs');
const multer = require('multer');
const path = require('path');
const { sanitizeFilename, validatePathWithinRoot, validateFileAgainstAllowlist } = require('../utils/pathValidator');

const router = express.Router();
const upload = multer({ dest: '/tmp/uploads/' });


function getMarzbanPath() {
  if (fs.existsSync('/var/lib/marzban/xray_config.json')) return '/var/lib/marzban';
  if (fs.existsSync('/var/lib/marzban-node/xray_config.json')) return '/var/lib/marzban-node';
  if (fs.existsSync('/var/lib/marzban')) return '/var/lib/marzban';
  if (fs.existsSync('/var/lib/marzban-node')) return '/var/lib/marzban-node';
  return '/var/lib/marzban'; // Default assumption
}

/**
 * @swagger
 * /api/auth/token:
 *   post:
 *     summary: OAuth2 token endpoint
 *     description: Get access token using OAuth2 password flow (for Swagger UI authentication)
 *     tags: [Authentication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/x-www-form-urlencoded:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *                 description: Username or email
 *               password:
 *                 type: string
 *                 description: Password
 *               grant_type:
 *                 type: string
 *                 default: password
 *     responses:
 *       200:
 *         description: Token generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 access_token:
 *                   type: string
 *                   description: JWT access token
 *                 token_type:
 *                   type: string
 *                   example: bearer
 *       400:
 *         description: Bad request - missing credentials
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *       401:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 */
// OAuth2 token endpoint for Swagger UI
router.post('/token', authRateLimiter, async function(req, res) {
  try {
    var username = req.body.username;
    var password = req.body.password;

    if (!username || !password) {
      return res.status(400).json({ error: 'invalid_request', error_description: 'Username and password are required' });
    }

    var user = await prisma.user.findFirst({ 
      where: { 
        OR: [
          { email: username },
          { username: username }
        ]
      } 
    });
    
    if (!user) {
      return res.status(401).json({ error: 'invalid_grant', error_description: 'Invalid username or password' });
    }

    var validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'invalid_grant', error_description: 'Invalid username or password' });
    }

    var token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET || 'your-secret-key', { expiresIn: '3d' });

    // OAuth2 standard response format
    res.json({
      access_token: token,
      token_type: 'bearer',
      expires_in: 259200, // 3 days in seconds
    });
  } catch (error) {
    console.error('Token generation error:', error);
    res.status(500).json({ error: 'server_error', error_description: 'Token generation failed' });
  }
});

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: User login
 *     description: Authenticate user with username/email and password
 *     tags: [Authentication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoginResponse'
 *       400:
 *         description: Bad request - missing credentials
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// Login
router.post('/login', authRateLimiter, async function(req, res) {
  try {
    var username = req.body.username || req.body.email;
    var password = req.body.password;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    var user = await prisma.user.findFirst({ 
      where: { 
        OR: [
          { email: username },
          { username: username }
        ]
      } 
    });
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    var validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    var token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET || 'your-secret-key', { expiresIn: '3d' });

    res.json({
      user: { 
        id: user.id, 
        username: user.username || user.email, 
        name: user.name 
      },
      token: token,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Get current user
 *     description: Get the authenticated user's profile information
 *     tags: [Authentication]
 *     security:
 *       - OAuth2PasswordBearer: []
 *     responses:
 *       200:
 *         description: User profile
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// Get current user
router.get('/me', authMiddleware, async function(req, res) {
  try {
    var user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { id: true, email: true, username: true, name: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ 
      user: { 
        id: user.id, 
        username: user.username || user.email, 
        name: user.name 
      } 
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

/**
 * @swagger
 * /api/auth/change-password:
 *   post:
 *     summary: Change password
 *     description: Change the current user's password
 *     tags: [Authentication]
 *     security:
 *       - OAuth2PasswordBearer: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *                 description: Current password
 *               newPassword:
 *                 type: string
 *                 description: New password
 *     responses:
 *       200:
 *         description: Password changed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       400:
 *         description: Current password is incorrect
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
 */
// Change password
router.post('/change-password', authMiddleware, async function(req, res) {
  try {
    var currentPassword = req.body.currentPassword;
    var newPassword = req.body.newPassword;

    var user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    var validPassword = await bcrypt.compare(currentPassword, user.password);
    if (!validPassword) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    var hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: req.userId },
      data: { password: hashedPassword },
    });

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

/**
 * @swagger
 * /api/auth/profile:
 *   put:
 *     summary: Update profile
 *     description: Update user profile (username and/or password)
 *     tags: [Authentication]
 *     security:
 *       - OAuth2PasswordBearer: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *             properties:
 *               username:
 *                 type: string
 *                 description: New username
 *               currentPassword:
 *                 type: string
 *                 description: Current password (required for verification)
 *               newPassword:
 *                 type: string
 *                 description: New password (optional)
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *                 message:
 *                   type: string
 *       400:
 *         description: Bad request - invalid input or current password incorrect
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
 */
// Update profile
router.put('/profile', authMiddleware, async function(req, res) {
  try {
    var userId = req.userId;
    var newUsername = req.body.username;
    var currentPassword = req.body.currentPassword;
    var newPassword = req.body.newPassword;
    
    if (!currentPassword) {
      return res.status(400).json({ error: 'Current password is required' });
    }

    var user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    var validPassword = await bcrypt.compare(currentPassword, user.password);
    if (!validPassword) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    var updateData = {};
    
    if (newUsername && newUsername !== user.username && newUsername !== user.email) {
      var existingUser = await prisma.user.findFirst({
        where: { 
          OR: [
            { email: newUsername },
            { username: newUsername }
          ],
          NOT: { id: userId }
        }
      });
      
      if (existingUser) {
        return res.status(400).json({ error: 'Username already taken' });
      }
      
      updateData.username = newUsername;
      updateData.email = newUsername;
    }
    
    if (newPassword) {
      if (newPassword.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
      }
      updateData.password = await bcrypt.hash(newPassword, 10);
    }
    
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'No changes to save' });
    }
    
    var updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: { id: true, email: true, username: true, name: true }
    });
    
    res.json({ 
      user: { 
        id: updatedUser.id, 
        username: updatedUser.username || updatedUser.email, 
        name: updatedUser.name 
      }, 
      message: 'Profile updated successfully' 
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

/**
 * @swagger
 * /api/auth/backup/full:
 *   get:
 *     summary: Download full backup
 *     description: Download a complete backup of the system (database and configurations)
 *     tags: [Authentication]
 *     security:
 *       - OAuth2PasswordBearer: []
 *     responses:
 *       200:
 *         description: Backup file download
 *         content:
 *           application/zip:
 *             schema:
 *               type: string
 *               format: binary
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: No backup files found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Failed to generate backup
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// Download Full Backup
router.get('/backup/full', authMiddleware, async function(req, res) {
  try {
    const marzbanPath = getMarzbanPath();
    const filesToBackup = [
      { path: '/app/data/db.sqlite', name: 'dashboard-db.sqlite' },
      { path: path.join(marzbanPath, 'db.sqlite3'), name: 'marzban-db.sqlite3' },
      { path: path.join(marzbanPath, 'xray_config.json'), name: 'xray_config.json' }
    ];

    const existingFiles = filesToBackup.filter(file => fs.existsSync(file.path));

    if (existingFiles.length === 0) {
      return res.status(404).json({ error: 'No backup files found on server.' });
    }

    const outputZip = `/tmp/full-backup-${Date.now()}.zip`;
    
    const paths = existingFiles.map(f => `"${f.path}"`).join(' ');
    const command = `zip -j ${outputZip} ${paths}`;

    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error('Zip creation failed:', stderr);
        return res.status(500).json({ error: 'Failed to create backup archive.' });
      }

      const date = new Date().toISOString().split('T')[0];
      res.download(outputZip, `full-backup-${date}.zip`, (err) => {
        if (err) console.error('Download error:', err);
        fs.unlink(outputZip, () => {}); 
      });
    });

  } catch (error) {
    console.error('Backup error:', error);
    res.status(500).json({ error: 'Failed to generate backup' });
  }
});

/**
 * @swagger
 * /api/auth/backup/restore:
 *   post:
 *     summary: Restore backup
 *     description: Restore system from a backup file
 *     tags: [Authentication]
 *     security:
 *       - OAuth2PasswordBearer: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - backup
 *             properties:
 *               backup:
 *                 type: string
 *                 format: binary
 *                 description: Backup ZIP file
 *     responses:
 *       200:
 *         description: Backup restored successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       400:
 *         description: Bad request - no file uploaded
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
 *         description: Failed to restore backup
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
//Restore Backup (With Automatic Restart of Multiple Containers)
router.post('/backup/restore', authMiddleware, upload.single('backup'), async function(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const targetMarzbanPath = getMarzbanPath();
    const zipPath = req.file.path;
    const extractPath = `/tmp/restore_${Date.now()}`;

    // Allowlist of expected backup file names (prevent arbitrary file restoration)
    const allowedFilenames = [
      'dashboard-db.sqlite',
      'db.sqlite',
      'marzban-db.sqlite3',
      'db.sqlite3',
      'xray_config.json'
    ];

    
    exec(`mkdir -p "${extractPath}" && unzip -o "${zipPath}" -d "${extractPath}"`, (err, stdout, stderr) => {
      if (err) {
        console.error('Unzip failed:', stderr);
        fs.unlink(zipPath, () => {});
        return res.status(500).json({ error: 'Failed to unzip backup file' });
      }

      try {
        
        const extractedFiles = fs.readdirSync(extractPath);
        
        // Validate all extracted files before processing
        for (const file of extractedFiles) {
        
          const sanitized = sanitizeFilename(file);
          
          // Check if sanitized name matches original (detect attack attempts)
          if (sanitized !== file) {
            console.error(`Suspicious filename detected: ${file}`);
            fs.unlink(zipPath, () => {});
            exec(`rm -rf "${extractPath}"`, () => {});
            return res.status(400).json({ error: 'Invalid file names in backup archive' });
          }
          
          // Validate against allowlist
          const fileValidation = validateFileAgainstAllowlist(file, allowedFilenames);
          if (!fileValidation.valid) {
            console.error(`File not in allowlist: ${file}`);
            fs.unlink(zipPath, () => {});
            exec(`rm -rf "${extractPath}"`, () => {});
            return res.status(400).json({ error: 'Backup contains unexpected files' });
          }
          
          // Validate the full path is within extraction directory
          const fullPath = path.join(extractPath, file);
          const pathValidation = validatePathWithinRoot(fullPath, extractPath);
          if (!pathValidation.valid) {
            console.error(`Path traversal attempt detected: ${file}`);
            fs.unlink(zipPath, () => {});
            exec(`rm -rf "${extractPath}"`, () => {});
            return res.status(400).json({ error: 'Path traversal attempt detected' });
          }
        }
       
        const restoreMap = [
          // Dashboard DB
          { src: 'dashboard-db.sqlite', dest: '/app/data/db.sqlite' },
          { src: 'db.sqlite', dest: '/app/data/db.sqlite' }, // Legacy name
          
          // Marzban DB & Config
          { src: 'marzban-db.sqlite3', dest: path.join(targetMarzbanPath, 'db.sqlite3') },
          { src: 'db.sqlite3', dest: path.join(targetMarzbanPath, 'db.sqlite3') }, // Legacy name
          { src: 'xray_config.json', dest: path.join(targetMarzbanPath, 'xray_config.json') }
        ];

        let restoredCount = 0;

      
        restoreMap.forEach(item => {

          const source = path.join(extractPath, item.src);
          
          // Double-check the source path is within extraction directory
          const sourceValidation = validatePathWithinRoot(source, extractPath);
          if (!sourceValidation.valid) {
            console.error(`Source path validation failed: ${item.src}`);
            return; 
          }
          
          if (fs.existsSync(source)) {
            
            const destDir = path.dirname(item.dest);
            if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

           
            fs.copyFileSync(source, item.dest);
            console.log(`Restored ${item.src} to ${item.dest}`);
            restoredCount++;
          }
        });

       
        fs.unlink(zipPath, () => {});
        exec(`rm -rf "${extractPath}"`, () => {});

        if (restoredCount === 0) {
            return res.status(400).json({ error: 'No recognizable database files found in zip' });
        }

        
        res.json({ message: `Restore successful (${restoredCount} files). Restarting Marzban containers...` });

        
        setTimeout(() => {
            console.log('Executing auto-restart for Marzban containers...');
            exec('docker restart marzban-marzban-1 marzban-dashboard', (err) => {
                if (err) {
                    console.error('Auto-restart command failed:', err);
                } else {
                    console.log('Containers restarted successfully.');
                }
            });
        }, 1000);

      } catch (e) {
        console.error('Copy failed:', e);
        fs.unlink(zipPath, () => {});
        exec(`rm -rf "${extractPath}"`, () => {});
        res.status(500).json({ error: 'File copy error: ' + e.message });
      }
    });
  } catch (error) {
    console.error('Restore error:', error);
    res.status(500).json({ error: 'Failed to restore backup' });
  }
});

module.exports = router;