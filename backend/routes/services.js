// routes/services.js - Service management endpoints
const express = require('express');
const router = express.Router();

// Supported services configuration
const SUPPORTED_SERVICES = {
  aws: { name: 'Amazon Web Services', icon: 'aws', color: '#FF9900' },
  gcp: { name: 'Google Cloud Platform', icon: 'gcp', color: '#4285F4' },
  atlassian: { name: 'Atlassian', icon: 'atlassian', color: '#0052CC' },
  'google-workspace': { name: 'Google Workspace', icon: 'google', color: '#34A853' },
  chatgpt: { name: 'ChatGPT', icon: 'openai', color: '#10A37F' },
  cohere: { name: 'Cohere', icon: 'cohere', color: '#D18EE2' }
};

// GET /api/services - Get all services with their status
router.get('/', async (req, res) => {
  try {
    const firestore = req.app.locals.firestore;

    // Get all services from Firestore
    const servicesSnapshot = await firestore.collection('services').get();

    const services = [];
    for (const doc of servicesSnapshot.docs) {
      const data = doc.data();
      const serviceId = doc.id;

      // Get latest cost for this service
      const latestCostSnapshot = await firestore
        .collection('costs')
        .where('serviceId', '==', serviceId)
        .orderBy('timestamp', 'desc')
        .limit(1)
        .get();

      const latestCost = latestCostSnapshot.empty ? null : latestCostSnapshot.docs[0].data();

      services.push({
        id: serviceId,
        ...SUPPORTED_SERVICES[serviceId],
        ...data,
        latestCost: latestCost ? {
          amount: latestCost.totalCost,
          timestamp: latestCost.timestamp,
          currency: latestCost.currency || 'USD'
        } : null
      });
    }

    res.json({ services });
  } catch (error) {
    console.error('Error fetching services:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/services/:serviceId - Get specific service details
router.get('/:serviceId', async (req, res) => {
  try {
    const { serviceId } = req.params;
    const firestore = req.app.locals.firestore;

    if (!SUPPORTED_SERVICES[serviceId]) {
      return res.status(404).json({ error: 'Service not found' });
    }

    const serviceDoc = await firestore.collection('services').doc(serviceId).get();

    if (!serviceDoc.exists) {
      // Return default service info
      return res.json({
        id: serviceId,
        ...SUPPORTED_SERVICES[serviceId],
        configured: false
      });
    }

    res.json({
      id: serviceId,
      ...SUPPORTED_SERVICES[serviceId],
      ...serviceDoc.data(),
      configured: true
    });
  } catch (error) {
    console.error('Error fetching service:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/services/:serviceId - Update service configuration
router.put('/:serviceId', async (req, res) => {
  try {
    const { serviceId } = req.params;
    const { billingCycleStart, predictedCost } = req.body;
    const firestore = req.app.locals.firestore;

    if (!SUPPORTED_SERVICES[serviceId]) {
      return res.status(404).json({ error: 'Service not found' });
    }

    const updateData = {
      updatedAt: new Date().toISOString()
    };

    if (billingCycleStart !== undefined) {
      updateData.billingCycleStart = billingCycleStart;
    }

    if (predictedCost !== undefined) {
      updateData.predictedCost = predictedCost;
    }

    await firestore.collection('services').doc(serviceId).set(updateData, { merge: true });

    res.json({
      success: true,
      serviceId,
      updatedFields: updateData
    });
  } catch (error) {
    console.error('Error updating service:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/services/supported - Get list of supported services
router.get('/meta/supported', async (req, res) => {
  res.json({ services: SUPPORTED_SERVICES });
});

module.exports = router;
