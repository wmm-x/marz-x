require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth.routes');
const marzbanRoutes = require('./routes/marzban.routes');
const userRoutes = require('./routes/user.routes');
const { seedDefaultAdmin } = require('./utils/seed');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

app.use(function(req, res, next) {
  console.log(req.method + ' ' + req. url);
  next();
});

app.use('/api/auth', authRoutes);
app.use('/api/marzban', marzbanRoutes);
app.use('/api/users', userRoutes);

app.get('/api/health', function(req, res) {
  res. json({ status: 'ok' });
});

app.use(function(req, res) {
  console.log('404 Not Found:', req. method, req.url);
  res.status(404).json({ error: 'Route not found' });
});

app.use(function(err, req, res, next) {
  console.error('Error:', err.message);
  res.status(500).json({ error: 'Server error' });
});

async function startServer() {
  try {
    await seedDefaultAdmin();
    app.listen(PORT, function() {
      console.log('Server running on http://localhost:' + PORT);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();