// Start auto optimization scheduler
const { startAutoOptimizationScheduler } = require('./autoOptimize');
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');

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
app.use(express.urlencoded({ extended: true })); 
s
app.use(express.static('public'));

app.use(function(req, res, next) {
  console.log(req.method + ' ' + req. url);
  next();
});

// Swagger API Documentation
app.use('/api-docs', swaggerUi.serve);
app.get('/api-docs', function(req, res, next) {
  const protocol = req.protocol;
  const host = req.get('host');
  const baseUrl = `${protocol}://${host}`;
  
  swaggerUi.setup(swaggerSpec, {
    customCssUrl: `/swagger-theme.css?v=${Date.now()}`,
    customSiteTitle: 'Marzban Dashboard API Docs',
    swaggerOptions: {
      persistAuthorization: true,
      oauth2RedirectUrl: `${baseUrl}/api-docs/oauth2-redirect.html`,
    },
  })(req, res, next);
});

// API routes
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
    startAutoOptimizationScheduler();
   app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();