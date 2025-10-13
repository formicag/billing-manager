// Setup script to configure GCP credentials in Firestore
const { Firestore } = require('@google-cloud/firestore');

const projectId = 'billing-manager-gf';
const firestore = new Firestore({ projectId });

async function setupGCPCredentials() {
  try {
    // Add credential metadata to Firestore
    await firestore.collection('credentials').doc('gcp').set({
      serviceId: 'gcp',
      credentialType: 'service-account',
      secretName: 'gcp-credentials',
      billingAccountId: '01C55A-05863D-B3C399',
      lastUpdated: new Date().toISOString()
    });

    console.log('✓ GCP credential metadata added to Firestore');

    // Enable the GCP service
    await firestore.collection('services').doc('gcp').set({
      enabled: true,
      updatedAt: new Date().toISOString()
    }, { merge: true });

    console.log('✓ GCP service enabled in Firestore');
    console.log('\nGCP billing credentials are now configured!');
    console.log('You can now trigger cost collection for GCP from the dashboard.');
  } catch (error) {
    console.error('Error setting up GCP credentials:', error);
    process.exit(1);
  }
}

setupGCPCredentials();
