// routes/credentials.js - Credential management endpoints
const express = require('express');
const router = express.Router();

// GET /api/credentials - Get all configured credentials (metadata only)
router.get('/', async (req, res) => {
  try {
    const firestore = req.app.locals.firestore;

    const snapshot = await firestore.collection('credentials').get();

    const credentials = snapshot.docs.map(doc => ({
      serviceId: doc.id,
      configured: true,
      lastUpdated: doc.data().lastUpdated,
      credentialType: doc.data().credentialType
    }));

    res.json({ credentials });
  } catch (error) {
    console.error('Error fetching credentials:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/credentials/:serviceId - Get credential metadata
router.get('/:serviceId', async (req, res) => {
  try {
    const { serviceId } = req.params;
    const firestore = req.app.locals.firestore;

    const doc = await firestore.collection('credentials').doc(serviceId).get();

    if (!doc.exists) {
      return res.status(404).json({
        error: 'Credentials not found',
        serviceId
      });
    }

    const data = doc.data();

    res.json({
      serviceId,
      configured: true,
      credentialType: data.credentialType,
      lastUpdated: data.lastUpdated,
      secretName: data.secretName
    });
  } catch (error) {
    console.error('Error fetching credential:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/credentials/:serviceId - Create or update credentials
router.post('/:serviceId', async (req, res) => {
  try {
    const { serviceId } = req.params;
    const { credentials, credentialType } = req.body;
    const firestore = req.app.locals.firestore;
    const secretManager = req.app.locals.secretManager;
    const projectId = req.app.locals.projectId;

    if (!credentials) {
      return res.status(400).json({ error: 'Credentials data is required' });
    }

    // Store in Secret Manager
    const secretName = `${serviceId}-credentials`;
    const secretPath = `projects/${projectId}/secrets/${secretName}`;

    try {
      // Check if secret exists
      await secretManager.getSecret({ name: secretPath });

      // Add new version
      await secretManager.addSecretVersion({
        parent: secretPath,
        payload: {
          data: Buffer.from(JSON.stringify(credentials), 'utf8')
        }
      });
    } catch (error) {
      if (error.code === 5) { // NOT_FOUND
        // Create new secret
        await secretManager.createSecret({
          parent: `projects/${projectId}`,
          secretId: secretName,
          secret: {
            replication: {
              automatic: {}
            }
          }
        });

        // Add version
        await secretManager.addSecretVersion({
          parent: secretPath,
          payload: {
            data: Buffer.from(JSON.stringify(credentials), 'utf8')
          }
        });
      } else {
        throw error;
      }
    }

    // Store metadata in Firestore
    await firestore.collection('credentials').doc(serviceId).set({
      serviceId,
      credentialType: credentialType || 'api-key',
      secretName,
      lastUpdated: new Date().toISOString()
    });

    // Automatically enable the service when credentials are saved
    await firestore.collection('services').doc(serviceId).set({
      enabled: true,
      updatedAt: new Date().toISOString()
    }, { merge: true });

    res.json({
      success: true,
      serviceId,
      message: 'Credentials saved successfully'
    });
  } catch (error) {
    console.error('Error saving credentials:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/credentials/:serviceId/reveal - Temporarily reveal credentials
router.post('/:serviceId/reveal', async (req, res) => {
  try {
    const { serviceId } = req.params;
    const firestore = req.app.locals.firestore;
    const secretManager = req.app.locals.secretManager;
    const projectId = req.app.locals.projectId;

    // Get credential metadata
    const doc = await firestore.collection('credentials').doc(serviceId).get();

    if (!doc.exists) {
      return res.status(404).json({
        error: 'Credentials not found',
        serviceId
      });
    }

    const { secretName } = doc.data();

    // Access secret from Secret Manager
    const [version] = await secretManager.accessSecretVersion({
      name: `projects/${projectId}/secrets/${secretName}/versions/latest`
    });

    const credentials = JSON.parse(version.payload.data.toString('utf8'));

    res.json({
      serviceId,
      credentials,
      warning: 'These credentials are displayed temporarily. Do not share them.'
    });
  } catch (error) {
    console.error('Error revealing credentials:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/credentials/:serviceId/test - Test credentials
router.post('/:serviceId/test', async (req, res) => {
  try {
    const { serviceId } = req.params;
    const { credentials } = req.body;

    // In a real implementation, this would test the credentials against the service API
    // For now, we'll just simulate a test

    // Simulate delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Mock validation
    const isValid = credentials && Object.keys(credentials).length > 0;

    res.json({
      success: isValid,
      serviceId,
      message: isValid ? 'Credentials are valid' : 'Invalid credentials',
      tested: true
    });
  } catch (error) {
    console.error('Error testing credentials:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/credentials/:serviceId - Delete credentials
router.delete('/:serviceId', async (req, res) => {
  try {
    const { serviceId } = req.params;
    const firestore = req.app.locals.firestore;
    const secretManager = req.app.locals.secretManager;
    const projectId = req.app.locals.projectId;

    // Get credential metadata
    const doc = await firestore.collection('credentials').doc(serviceId).get();

    if (doc.exists) {
      const { secretName } = doc.data();

      // Delete from Secret Manager
      try {
        await secretManager.deleteSecret({
          name: `projects/${projectId}/secrets/${secretName}`
        });
      } catch (error) {
        console.error('Error deleting secret:', error);
        // Continue even if secret deletion fails
      }

      // Delete from Firestore
      await firestore.collection('credentials').doc(serviceId).delete();

      // Disable the service when credentials are deleted
      await firestore.collection('services').doc(serviceId).set({
        enabled: false,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    }

    res.json({
      success: true,
      serviceId,
      message: 'Credentials deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting credentials:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
