// routes/costs.js - Cost data endpoints
const express = require('express');
const router = express.Router();

// GET /api/costs - Get cost data with optional filters
router.get('/', async (req, res) => {
  try {
    const { serviceId, startDate, endDate, limit = 100 } = req.query;
    const firestore = req.app.locals.firestore;

    let query = firestore.collection('costs');

    // Apply filters
    if (serviceId) {
      query = query.where('serviceId', '==', serviceId);
    }

    if (startDate) {
      query = query.where('timestamp', '>=', new Date(startDate).toISOString());
    }

    if (endDate) {
      query = query.where('timestamp', '<=', new Date(endDate).toISOString());
    }

    // Order by timestamp descending and limit
    query = query.orderBy('timestamp', 'desc').limit(parseInt(limit));

    const snapshot = await query.get();
    const costs = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    res.json({ costs, count: costs.length });
  } catch (error) {
    console.error('Error fetching costs:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/costs/summary - Get cost summary by service
router.get('/summary', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const firestore = req.app.locals.firestore;

    let query = firestore.collection('costs');

    if (startDate) {
      query = query.where('timestamp', '>=', new Date(startDate).toISOString());
    }

    if (endDate) {
      query = query.where('timestamp', '<=', new Date(endDate).toISOString());
    }

    const snapshot = await query.get();

    // Aggregate by service
    const summaryByService = {};
    let totalCost = 0;
    let lastUpdated = null;

    snapshot.forEach(doc => {
      const data = doc.data();
      const serviceId = data.serviceId;

      if (!summaryByService[serviceId]) {
        summaryByService[serviceId] = {
          totalCost: 0,
          count: 0,
          currency: data.currency || 'USD',
          firstTimestamp: data.timestamp,
          lastTimestamp: data.timestamp
        };
      }

      summaryByService[serviceId].totalCost += data.totalCost || 0;
      summaryByService[serviceId].count += 1;
      totalCost += data.totalCost || 0;

      if (data.timestamp < summaryByService[serviceId].firstTimestamp) {
        summaryByService[serviceId].firstTimestamp = data.timestamp;
      }
      if (data.timestamp > summaryByService[serviceId].lastTimestamp) {
        summaryByService[serviceId].lastTimestamp = data.timestamp;
      }

      // Track overall last updated timestamp
      if (!lastUpdated || data.timestamp > lastUpdated) {
        lastUpdated = data.timestamp;
      }
    });

    res.json({
      summary: summaryByService,
      totalCost,
      lastUpdated
    });
  } catch (error) {
    console.error('Error fetching cost summary:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/costs/:serviceId/resources - Get resource-level costs for a service
router.get('/:serviceId/resources', async (req, res) => {
  try {
    const { serviceId } = req.params;
    const { startDate, endDate, tags } = req.query;
    const firestore = req.app.locals.firestore;

    let query = firestore.collection('costs')
      .where('serviceId', '==', serviceId);

    if (startDate) {
      query = query.where('timestamp', '>=', new Date(startDate).toISOString());
    }

    if (endDate) {
      query = query.where('timestamp', '<=', new Date(endDate).toISOString());
    }

    const snapshot = await query.get();

    // Aggregate resources
    const resourcesMap = {};

    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.resources && Array.isArray(data.resources)) {
        data.resources.forEach(resource => {
          // Filter by tags if provided
          if (tags) {
            const tagFilter = JSON.parse(tags);
            const resourceTags = resource.tags || {};
            const matches = Object.keys(tagFilter).every(
              key => resourceTags[key] === tagFilter[key]
            );
            if (!matches) return;
          }

          const resourceKey = resource.resourceId || resource.name;
          if (!resourcesMap[resourceKey]) {
            resourcesMap[resourceKey] = {
              resourceId: resourceKey,
              resourceType: resource.type,
              totalCost: 0,
              tags: resource.tags || {},
              dataPoints: []
            };
          }

          resourcesMap[resourceKey].totalCost += resource.cost || 0;
          resourcesMap[resourceKey].dataPoints.push({
            timestamp: data.timestamp,
            cost: resource.cost || 0
          });
        });
      }
    });

    const resources = Object.values(resourcesMap);

    res.json({ resources, count: resources.length });
  } catch (error) {
    console.error('Error fetching resource costs:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/costs/collect - Trigger manual cost collection
router.post('/collect', async (req, res) => {
  try {
    const { serviceId } = req.body;
    const firestore = req.app.locals.firestore;

    if (!serviceId) {
      return res.status(400).json({ error: 'serviceId is required' });
    }

    // Check if credentials exist
    const credDoc = await firestore.collection('credentials').doc(serviceId).get();

    if (!credDoc.exists) {
      return res.status(400).json({
        error: 'No credentials configured for this service',
        serviceId
      });
    }

    // In a real implementation, this would trigger the cost collection job
    // For now, we'll just acknowledge the request
    res.json({
      success: true,
      message: 'Cost collection triggered',
      serviceId,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error triggering cost collection:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/costs/:costId - Delete a cost entry
router.delete('/:costId', async (req, res) => {
  try {
    const { costId } = req.params;
    const firestore = req.app.locals.firestore;

    await firestore.collection('costs').doc(costId).delete();

    res.json({
      success: true,
      costId,
      message: 'Cost entry deleted'
    });
  } catch (error) {
    console.error('Error deleting cost entry:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
