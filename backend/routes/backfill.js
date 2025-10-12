// routes/backfill.js - Historical data backfill endpoints
const express = require('express');
const router = express.Router();

// POST /api/backfill - Trigger historical data backfill
router.post('/', async (req, res) => {
  try {
    const { serviceId, startDate, endDate } = req.body;
    const firestore = req.app.locals.firestore;

    if (!serviceId || !startDate || !endDate) {
      return res.status(400).json({
        error: 'serviceId, startDate, and endDate are required'
      });
    }

    // Validate dates
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({
        error: 'Invalid date format'
      });
    }

    if (start >= end) {
      return res.status(400).json({
        error: 'startDate must be before endDate'
      });
    }

    // Check if credentials exist
    const credDoc = await firestore.collection('credentials').doc(serviceId).get();

    if (!credDoc.exists) {
      return res.status(400).json({
        error: 'No credentials configured for this service',
        serviceId
      });
    }

    // Create backfill job
    const jobId = `backfill-${serviceId}-${Date.now()}`;
    const jobData = {
      jobId,
      serviceId,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      status: 'pending',
      createdAt: new Date().toISOString(),
      progress: 0,
      totalDays: Math.ceil((end - start) / (1000 * 60 * 60 * 24))
    };

    await firestore.collection('backfill-jobs').doc(jobId).set(jobData);

    // In a real implementation, this would trigger a background job
    // For now, we just create the job record

    res.json({
      success: true,
      jobId,
      message: 'Backfill job created',
      job: jobData
    });
  } catch (error) {
    console.error('Error creating backfill job:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/backfill/jobs - Get all backfill jobs
router.get('/jobs', async (req, res) => {
  try {
    const { serviceId, status } = req.query;
    const firestore = req.app.locals.firestore;

    let query = firestore.collection('backfill-jobs');

    if (serviceId) {
      query = query.where('serviceId', '==', serviceId);
    }

    if (status) {
      query = query.where('status', '==', status);
    }

    query = query.orderBy('createdAt', 'desc').limit(50);

    const snapshot = await query.get();
    const jobs = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    res.json({ jobs, count: jobs.length });
  } catch (error) {
    console.error('Error fetching backfill jobs:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/backfill/jobs/:jobId - Get backfill job status
router.get('/jobs/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    const firestore = req.app.locals.firestore;

    const doc = await firestore.collection('backfill-jobs').doc(jobId).get();

    if (!doc.exists) {
      return res.status(404).json({
        error: 'Backfill job not found',
        jobId
      });
    }

    res.json({
      jobId,
      ...doc.data()
    });
  } catch (error) {
    console.error('Error fetching backfill job:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/backfill/jobs/:jobId - Cancel/delete backfill job
router.delete('/jobs/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    const firestore = req.app.locals.firestore;

    const doc = await firestore.collection('backfill-jobs').doc(jobId).get();

    if (!doc.exists) {
      return res.status(404).json({
        error: 'Backfill job not found',
        jobId
      });
    }

    const job = doc.data();

    if (job.status === 'running') {
      // Mark as cancelled instead of deleting
      await firestore.collection('backfill-jobs').doc(jobId).update({
        status: 'cancelled',
        cancelledAt: new Date().toISOString()
      });

      res.json({
        success: true,
        jobId,
        message: 'Backfill job cancelled'
      });
    } else {
      // Delete if not running
      await firestore.collection('backfill-jobs').doc(jobId).delete();

      res.json({
        success: true,
        jobId,
        message: 'Backfill job deleted'
      });
    }
  } catch (error) {
    console.error('Error deleting backfill job:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
