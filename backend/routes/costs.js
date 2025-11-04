// routes/costs.js - Cost data endpoints
const express = require('express');
const router = express.Router();
const { collectCurrentMonthCosts: collectAWSCosts, getAWSBudgets } = require('../services/aws-collector');
const { collectCurrentMonthCosts: collectGCPCosts } = require('../services/gcp-collector');
const { collectCurrentMonthCosts: collectGoogleWorkspaceCosts } = require('../services/google-workspace-collector');
const { collectCurrentMonthCosts: collectAtlassianCosts } = require('../services/atlassian-collector');
const { collectCurrentMonthCosts: collectChatGPTCosts } = require('../services/chatgpt-collector');
const { collectCurrentMonthCosts: collectCohereCosts } = require('../services/cohere-collector');

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
    const secretManager = req.app.locals.secretManager;
    const projectId = req.app.locals.projectId;

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

    // Get credentials from Secret Manager
    const credData = credDoc.data();
    const { secretName, billingAccountId, accountId } = credData;
    const [version] = await secretManager.accessSecretVersion({
      name: `projects/${projectId}/secrets/${secretName}/versions/latest`
    });
    const credentials = JSON.parse(version.payload.data.toString('utf8'));

    // Collect costs based on service type
    let result;
    if (serviceId === 'aws') {
      // Add accountId to credentials if it exists in metadata
      if (accountId) {
        credentials.accountId = accountId;
      }
      result = await collectAWSCosts(credentials);
    } else if (serviceId === 'gcp') {
      if (!billingAccountId) {
        return res.status(400).json({
          error: 'GCP billing account ID not configured',
          serviceId
        });
      }
      result = await collectGCPCosts(credentials, billingAccountId);
    } else if (serviceId === 'google-workspace') {
      const { customerId, adminEmail } = credData;
      if (!customerId || !adminEmail) {
        return res.status(400).json({
          error: 'Google Workspace Customer ID or Admin Email not configured',
          serviceId
        });
      }
      result = await collectGoogleWorkspaceCosts(credentials, customerId, adminEmail);
    } else if (serviceId === 'atlassian') {
      result = await collectAtlassianCosts(credentials);
    } else if (serviceId === 'chatgpt') {
      result = await collectChatGPTCosts(credentials);
    } else if (serviceId === 'cohere') {
      result = await collectCohereCosts(credentials);
    } else {
      return res.status(400).json({
        error: `Cost collection not implemented for ${serviceId}`,
        serviceId
      });
    }

    // Store costs in Firestore with deduplication
    // Use composite key: serviceId + date to prevent duplicates

    // First, check which records already exist (efficient batch check)
    const existingDocIds = new Set();
    const docIdsToCheck = result.costs.map(cost => {
      const date = cost.timestamp.split('T')[0];
      return `${serviceId}_${date}`;
    });

    // Batch get existing documents
    const existingDocs = await firestore.getAll(
      ...docIdsToCheck.map(id => firestore.collection('costs').doc(id))
    );
    existingDocs.forEach(doc => {
      if (doc.exists) {
        existingDocIds.add(doc.id);
      }
    });

    // Now batch write/update
    const batch = firestore.batch();
    let newRecords = 0;
    let updatedRecords = 0;

    for (const cost of result.costs) {
      // Extract date from timestamp (YYYY-MM-DD)
      const date = cost.timestamp.split('T')[0];
      const docId = `${serviceId}_${date}`;
      const docRef = firestore.collection('costs').doc(docId);

      if (existingDocIds.has(docId)) {
        // Update existing record (keeps most recent data)
        batch.update(docRef, {
          ...cost,
          updatedAt: new Date().toISOString()
        });
        updatedRecords++;
      } else {
        // Create new record
        batch.set(docRef, {
          ...cost,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        newRecords++;
      }
    }

    await batch.commit();
    console.log(`[${serviceId}] Deduplication: ${newRecords} new, ${updatedRecords} updated`);

    // Record successful collection status
    const collectionTime = new Date().toISOString();
    await firestore.collection('collection_status').doc(serviceId).set({
      serviceId,
      status: 'success',
      lastRun: collectionTime,
      costsCollected: result.count,
      warning: result.warning || null,
      error: null
    });

    res.json({
      success: true,
      message: 'Cost collection completed',
      serviceId,
      costsCollected: result.count,
      newRecords,
      updatedRecords,
      timestamp: collectionTime,
      warning: result.warning
    });
  } catch (error) {
    console.error('Error triggering cost collection:', error);

    // Record failed collection status
    try {
      await firestore.collection('collection_status').doc(serviceId).set({
        serviceId,
        status: 'error',
        lastRun: new Date().toISOString(),
        costsCollected: 0,
        warning: null,
        error: error.message
      });
    } catch (statusError) {
      console.error('Failed to record error status:', statusError);
    }

    res.status(500).json({ error: error.message });
  }
});

// GET /api/costs/status - Get collection status for all services
router.get('/status/all', async (req, res) => {
  try {
    const firestore = req.app.locals.firestore;
    const snapshot = await firestore.collection('collection_status').get();

    const statuses = {};
    snapshot.forEach(doc => {
      statuses[doc.id] = doc.data();
    });

    res.json({ statuses });
  } catch (error) {
    console.error('Error fetching collection statuses:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/costs/:costId - Delete a cost entry
router.delete('/:costId', async (req, res) => {
  try {
    const { costId} = req.params;
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

// GET /api/costs/:serviceId/budgets - Get budgets for a service
router.get('/:serviceId/budgets', async (req, res) => {
  try {
    const { serviceId } = req.params;
    const firestore = req.app.locals.firestore;

    // Get most recent cost entry for this service
    const snapshot = await firestore.collection('costs')
      .where('serviceId', '==', serviceId)
      .orderBy('timestamp', 'desc')
      .limit(1)
      .get();

    if (snapshot.empty) {
      return res.json({ budgets: [], forecast: null });
    }

    const costData = snapshot.docs[0].data();

    res.json({
      budgets: costData.budgets || [],
      forecast: costData.forecast || null,
      count: (costData.budgets || []).length
    });
  } catch (error) {
    console.error('Error fetching budgets:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/costs/anomalies - Detect cost anomalies
router.get('/anomalies', async (req, res) => {
  try {
    const { serviceId, threshold = 50 } = req.query; // threshold is % increase
    const firestore = req.app.locals.firestore;

    let query = firestore.collection('costs');
    if (serviceId) {
      query = query.where('serviceId', '==', serviceId);
    }

    query = query.orderBy('timestamp', 'desc').limit(60); // Last 60 days
    const snapshot = await query.get();

    if (snapshot.empty) {
      return res.json({ anomalies: [], count: 0 });
    }

    // Group by serviceId and analyze trends
    const costsByService = {};
    snapshot.forEach(doc => {
      const data = doc.data();
      if (!costsByService[data.serviceId]) {
        costsByService[data.serviceId] = [];
      }
      costsByService[data.serviceId].push({
        timestamp: data.timestamp,
        totalCost: data.totalCost || 0,
        resources: data.resources || []
      });
    });

    const anomalies = [];
    const thresholdPercent = parseFloat(threshold);

    // Detect anomalies for each service
    Object.entries(costsByService).forEach(([svcId, costs]) => {
      // Sort by timestamp
      costs.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

      if (costs.length < 7) return; // Need at least 7 days for comparison

      // Calculate 7-day moving average (excluding today)
      const recentCosts = costs.slice(-8, -1); // Last 7 days before today
      const avgCost = recentCosts.reduce((sum, c) => sum + c.totalCost, 0) / recentCosts.length;

      // Compare today with average
      const todayCost = costs[costs.length - 1].totalCost;
      const percentChange = avgCost > 0 ? ((todayCost - avgCost) / avgCost) * 100 : 0;

      if (percentChange > thresholdPercent) {
        anomalies.push({
          serviceId: svcId,
          type: 'cost_spike',
          severity: percentChange > 100 ? 'high' : 'medium',
          currentCost: todayCost,
          averageCost: avgCost,
          percentChange: percentChange.toFixed(2),
          timestamp: costs[costs.length - 1].timestamp,
          message: `Cost increased by ${percentChange.toFixed(1)}% (avg: $${avgCost.toFixed(2)}, current: $${todayCost.toFixed(2)})`
        });
      }

      // Check for resource-level anomalies
      const todayResources = costs[costs.length - 1].resources;
      const avgResourceCosts = {};

      // Calculate average cost per resource
      recentCosts.forEach(cost => {
        (cost.resources || []).forEach(resource => {
          const key = resource.resourceId || resource.name;
          if (!avgResourceCosts[key]) {
            avgResourceCosts[key] = { total: 0, count: 0, name: resource.name, type: resource.type };
          }
          avgResourceCosts[key].total += resource.cost || 0;
          avgResourceCosts[key].count += 1;
        });
      });

      // Compare today's resources with averages
      todayResources.forEach(resource => {
        const key = resource.resourceId || resource.name;
        const avgData = avgResourceCosts[key];
        if (avgData && avgData.count > 0) {
          const avgResourceCost = avgData.total / avgData.count;
          const resourcePercentChange = avgResourceCost > 0
            ? ((resource.cost - avgResourceCost) / avgResourceCost) * 100
            : 0;

          if (resourcePercentChange > thresholdPercent) {
            anomalies.push({
              serviceId: svcId,
              type: 'resource_spike',
              severity: resourcePercentChange > 100 ? 'high' : 'medium',
              resourceId: key,
              resourceName: resource.name,
              resourceType: resource.type,
              currentCost: resource.cost,
              averageCost: avgResourceCost,
              percentChange: resourcePercentChange.toFixed(2),
              timestamp: costs[costs.length - 1].timestamp,
              message: `Resource "${resource.name}" cost increased by ${resourcePercentChange.toFixed(1)}% (avg: $${avgResourceCost.toFixed(2)}, current: $${resource.cost.toFixed(2)})`
            });
          }
        }
      });
    });

    res.json({ anomalies, count: anomalies.length });
  } catch (error) {
    console.error('Error detecting cost anomalies:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
