// server.js - Main Express application
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { Firestore } = require('@google-cloud/firestore');
const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');

const costRoutes = require('./routes/costs');
const credentialRoutes = require('./routes/credentials');
const scheduleRoutes = require('./routes/schedules');
const serviceRoutes = require('./routes/services');
const backfillRoutes = require('./routes/backfill');
const healthRoutes = require('./routes/health');
const budgetRoutes = require('./routes/budgets');

const app = express();
const PORT = process.env.PORT || 8080;
const PROJECT_ID = process.env.PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT;

// Initialize Firestore
const firestore = new Firestore({
  projectId: PROJECT_ID,
  ignoreUndefinedProperties: true
});

// Initialize Secret Manager
const secretManager = new SecretManagerServiceClient();

// Make clients available to routes
app.locals.firestore = firestore;
app.locals.secretManager = secretManager;
app.locals.projectId = PROJECT_ID;

// Middleware
app.use(helmet()); // Security headers
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined')); // Logging

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log({
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString()
    });
  });
  next();
});

// Routes
app.use('/api/health', healthRoutes);
app.use('/api/costs', costRoutes);
app.use('/api/credentials', credentialRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/backfill', backfillRoutes);
app.use('/api/budgets', budgetRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Billing Manager API',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/api/health',
      costs: '/api/costs',
      credentials: '/api/credentials',
      schedules: '/api/schedules',
      services: '/api/services',
      backfill: '/api/backfill',
      budgets: '/api/budgets'
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method
  });

  res.status(err.status || 500).json({
    error: {
      message: err.message || 'Internal server error',
      status: err.status || 500,
      path: req.path
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: {
      message: 'Endpoint not found',
      status: 404,
      path: req.path
    }
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`Billing Manager API running on port ${PORT}`);
  console.log(`Project ID: ${PROJECT_ID}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
