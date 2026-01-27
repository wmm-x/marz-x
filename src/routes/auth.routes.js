const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../utils/prisma');
const authMiddleware = require('../middleware/auth.middleware');
// [NEW] Required for backup functionality
const { exec } = require('child_process');
const fs = require('fs');

const router = express.Router();

// Login
router.post('/login', async function(req, res) {
  try {
    var username = req.body.username || req.body.email;
    var password = req.body.password;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Find user by username or email
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

    // Check password
    var validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Generate token
    var token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET || 'your-secret-key', { expiresIn: '7d' });

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

// Change password
router.post('/change-password', authMiddleware, async function(req, res) {
  try {
    var currentPassword = req.body.currentPassword;
    var newPassword = req.body.newPassword;

    var user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify current password
    var validPassword = await bcrypt.compare(currentPassword, user.password);
    if (!validPassword) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    // Hash new password
    var hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
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

// Update profile (username and/or password)
router.put('/profile', authMiddleware, async function(req, res) {
  try {
    var userId = req.userId;
    var newUsername = req.body.username;
    var currentPassword = req.body.currentPassword;
    var newPassword = req.body.newPassword;
    
    // Current password is always required
    if (!currentPassword) {
      return res.status(400).json({ error: 'Current password is required' });
    }

    // Get current user
    var user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify current password
    var validPassword = await bcrypt.compare(currentPassword, user.password);
    if (!validPassword) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    var updateData = {};
    
    // Update username if provided and different
    if (newUsername && newUsername !== user.username && newUsername !== user.email) {
      // Check if username already exists
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
    
    // Update password if provided
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

// [NEW] Download Full Backup (Dashboard DB + Marzban Node Files)
router.get('/backup/full', authMiddleware, async function(req, res) {
  try {
    // 1. Define all files you want to backup
    const filesToBackup = [
      '/app/data/db.sqlite',                  // Dashboard Database
      '/var/lib/marzban-node/db.sqlite3',     // Marzban Node Database
      '/var/lib/marzban-node/xray_config.json' // Marzban Config
    ];

    // 2. Filter out files that don't exist to prevent zip errors
    const existingFiles = filesToBackup.filter(file => fs.existsSync(file));

    if (existingFiles.length === 0) {
      return res.status(404).json({ error: 'No backup files found on server.' });
    }

    // 3. Prepare Zip Command
    const outputZip = `/tmp/full-backup-${Date.now()}.zip`;
    // -j: Junk paths (stores just the files, not the folder structure)
    const command = `zip -j ${outputZip} "${existingFiles.join('" "')}"`;

    // 4. Execute Zip
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error('Zip creation failed:', stderr);
        return res.status(500).json({ error: 'Failed to create backup archive. Check volume mounts.' });
      }

      // 5. Send the file
      const date = new Date().toISOString().split('T')[0];
      res.download(outputZip, `full-backup-${date}.zip`, (err) => {
        if (err) console.error('Download error:', err);
        
        // Cleanup: Delete the temp zip file after sending
        fs.unlink(outputZip, () => {}); 
      });
    });

  } catch (error) {
    console.error('Backup error:', error);
    res.status(500).json({ error: 'Failed to generate backup' });
  }
});

module.exports = router;