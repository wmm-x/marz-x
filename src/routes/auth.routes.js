const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../utils/prisma');
const authMiddleware = require('../middleware/auth.middleware');

const router = express.Router();



// Login
router.post('/login', async function(req, res) {
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

    // Generate token
    var token = jwt.sign({ userId: user. id }, process.env.JWT_SECRET || 'your-secret-key', { expiresIn:  '7d' });

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

    var validPassword = await bcrypt.compare(currentPassword, user.password);
    if (!validPassword) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    var hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await prisma. user.update({
      where: { id: req.userId },
      data: { password: hashedPassword },
    });

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

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

    // Verify current password
    var validPassword = await bcrypt. compare(currentPassword, user.password);
    if (!validPassword) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    var updateData = {};
    
    if (newUsername && newUsername !== user.username && newUsername !== user.email) {
      // Check if username already exists
      var existingUser = await prisma. user.findFirst({
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

module.exports = router;