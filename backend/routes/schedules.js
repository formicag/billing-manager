// routes/schedules.js - Schedule management endpoints
const express = require('express');
const router = express.Router();

// GET /api/schedules - Get all schedules
router.get('/', async (req, res) => {
  try {
    const firestore = req.app.locals.firestore;

    const snapshot = await firestore.collection('schedules').get();

    const schedules = snapshot.docs.map(doc => ({
      serviceId: doc.id,
      ...doc.data()
    }));

    res.json({ schedules });
  } catch (error) {
    console.error('Error fetching schedules:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/schedules/:serviceId - Get schedule for a service
router.get('/:serviceId', async (req, res) => {
  try {
    const { serviceId } = req.params;
    const firestore = req.app.locals.firestore;

    const doc = await firestore.collection('schedules').doc(serviceId).get();

    if (!doc.exists) {
      return res.json({
        serviceId,
        enabled: false,
        frequency: 'daily',
        lastRun: null
      });
    }

    res.json({
      serviceId,
      ...doc.data()
    });
  } catch (error) {
    console.error('Error fetching schedule:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/schedules/:serviceId - Update schedule for a service
router.put('/:serviceId', async (req, res) => {
  try {
    const { serviceId } = req.params;
    const { enabled, frequency, customCron } = req.body;
    const firestore = req.app.locals.firestore;

    if (frequency && !['hourly', 'daily', 'weekly', 'custom'].includes(frequency)) {
      return res.status(400).json({
        error: 'Invalid frequency. Must be: hourly, daily, weekly, or custom'
      });
    }

    if (frequency === 'custom' && !customCron) {
      return res.status(400).json({
        error: 'customCron is required when frequency is custom'
      });
    }

    const scheduleData = {
      serviceId,
      enabled: enabled !== undefined ? enabled : true,
      frequency: frequency || 'daily',
      updatedAt: new Date().toISOString()
    };

    if (customCron) {
      scheduleData.customCron = customCron;
    }

    await firestore.collection('schedules').doc(serviceId).set(scheduleData, { merge: true });

    // In a real implementation, this would update Cloud Scheduler jobs
    // For now, we just store the configuration

    res.json({
      success: true,
      serviceId,
      schedule: scheduleData,
      message: 'Schedule updated successfully'
    });
  } catch (error) {
    console.error('Error updating schedule:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/schedules/:serviceId - Delete schedule for a service
router.delete('/:serviceId', async (req, res) => {
  try {
    const { serviceId } = req.params;
    const firestore = req.app.locals.firestore;

    await firestore.collection('schedules').doc(serviceId).delete();

    res.json({
      success: true,
      serviceId,
      message: 'Schedule deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting schedule:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/schedules/:serviceId/run - Manually trigger a scheduled job
router.post('/:serviceId/run', async (req, res) => {
  try {
    const { serviceId } = req.params;
    const firestore = req.app.locals.firestore;

    // Update last run timestamp
    await firestore.collection('schedules').doc(serviceId).set({
      lastRun: new Date().toISOString()
    }, { merge: true });

    // In a real implementation, this would trigger the cost collection
    // For now, we just acknowledge

    res.json({
      success: true,
      serviceId,
      message: 'Job triggered successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error running schedule:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
