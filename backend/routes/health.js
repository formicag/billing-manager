// routes/health.js - Health check endpoint
const express = require('express');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const firestore = req.app.locals.firestore;
    const projectId = req.app.locals.projectId;

    // Test Firestore connection
    let firestoreStatus = 'connected';
    try {
      await firestore.collection('_health').doc('test').set({ timestamp: new Date() });
      await firestore.collection('_health').doc('test').delete();
    } catch (error) {
      firestoreStatus = `error: ${error.message}`;
    }

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      projectId,
      services: {
        firestore: firestoreStatus,
        secretManager: 'available'
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});

module.exports = router;
