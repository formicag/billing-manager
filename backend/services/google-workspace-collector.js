// services/google-workspace-collector.js - Google Workspace License Management integration

/**
 * Collect Google Workspace license costs
 * @param {Object} credentials - Google Workspace service account credentials
 * @param {string} customerId - Google Workspace customer ID (e.g., C039jcbjy)
 * @param {string} adminEmail - Admin email for domain-wide delegation
 * @returns {Promise<Object>} License cost data
 */
async function collectGoogleWorkspaceCosts(credentials, customerId, adminEmail) {
  console.log(`Collecting Google Workspace licenses for customer: ${customerId}`);

  const { google } = require('googleapis');
  const { JWT } = require('google-auth-library');

  try {
    // Create JWT client with domain-wide delegation
    const client = new JWT({
      email: credentials.client_email,
      key: credentials.private_key,
      scopes: ['https://www.googleapis.com/auth/apps.licensing'],
      subject: adminEmail, // Impersonate the admin user
    });

    // Initialize Licensing API
    const licensing = google.licensing({ version: 'v1', auth: client });

    // Get all license assignments for this customer
    const response = await licensing.licenseAssignments.listForProduct({
      productId: 'Google-Apps',
      customerId: customerId,
      maxResults: 1000,
    });

    const licenses = response.data.items || [];

    // License pricing (approximate monthly costs in USD)
    const licensePricing = {
      'Google-Apps-For-Business': 12.00,           // Business Starter
      'Google-Apps-Unlimited': 20.00,              // Business Standard
      'Google-Apps-For-Postini': 25.00,            // Business Plus
      '1010020027': 12.00,                         // Google Workspace Business Starter
      '1010020028': 20.00,                         // Google Workspace Business Standard
      '1010020025': 25.00,                         // Google Workspace Business Plus
      '1010020026': 30.00,                         // Google Workspace Enterprise Standard
      '1010060001': 30.00,                         // Google Workspace Enterprise Plus
      'Google-Apps-Lite': 6.00,                    // Legacy G Suite Basic
      'Google-Vault': 5.00,                        // Vault addon
      'Google-Vault-Former-Employee': 5.00,        // Vault for former employee
    };

    // Group licenses by SKU
    const licenseCounts = {};
    const licenseUsers = {};

    licenses.forEach(license => {
      const skuId = license.skuId;
      const skuName = license.skuName || skuId;

      if (!licenseCounts[skuId]) {
        licenseCounts[skuId] = {
          skuId,
          skuName,
          count: 0,
          unitPrice: licensePricing[skuId] || 0,
          users: [],
        };
      }

      licenseCounts[skuId].count++;
      licenseCounts[skuId].users.push(license.userId);
    });

    // Calculate total monthly cost
    let totalMonthlyCost = 0;
    const resources = [];

    for (const [skuId, data] of Object.entries(licenseCounts)) {
      const licenseCost = data.count * data.unitPrice;
      totalMonthlyCost += licenseCost;

      resources.push({
        resourceId: skuId,
        name: data.skuName,
        type: 'Google Workspace License',
        cost: licenseCost,
        tags: {
          skuId: skuId,
          licenseCount: data.count.toString(),
          unitPrice: data.unitPrice.toString(),
          users: data.users.length <= 5 ? data.users.join(', ') : `${data.users.length} users`,
        },
      });
    }

    // For daily granularity, divide monthly cost by ~30 days
    const dailyCost = totalMonthlyCost / 30;

    // Return cost for today
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    const costs = [{
      serviceId: 'google-workspace',
      timestamp: new Date(todayStr).toISOString(),
      totalCost: dailyCost,
      currency: 'USD',
      resources: resources,
      metadata: {
        granularity: 'DAILY',
        source: 'Google Workspace Licensing API',
        customerId: customerId,
        totalLicenses: licenses.length,
        estimatedMonthlyCost: totalMonthlyCost,
        note: 'Costs are estimated based on standard license pricing. Actual costs may vary based on your billing terms.',
      },
    }];

    return {
      success: true,
      costs,
      count: costs.length,
      summary: {
        totalLicenses: licenses.length,
        estimatedMonthlyCost: totalMonthlyCost,
        estimatedDailyCost: dailyCost,
        licenseBreakdown: Object.values(licenseCounts).map(l => ({
          skuName: l.skuName,
          count: l.count,
          monthlyCost: l.count * l.unitPrice,
        })),
      },
    };
  } catch (error) {
    console.error('Error collecting Google Workspace licenses:', error);

    if (error.code === 403) {
      throw new Error(
        'Permission denied. Please verify:\n' +
        '1. Domain-wide delegation is configured correctly\n' +
        '2. The OAuth scope is authorized: https://www.googleapis.com/auth/apps.licensing\n' +
        '3. The admin email has the necessary permissions'
      );
    }

    if (error.code === 404) {
      throw new Error(
        'Customer not found. Please verify the Customer ID is correct.\n' +
        `Provided Customer ID: ${customerId}`
      );
    }

    throw new Error(`Failed to collect Google Workspace licenses: ${error.message}`);
  }
}

/**
 * Collect licenses for the current month
 */
async function collectCurrentMonthCosts(credentials, customerId, adminEmail) {
  return collectGoogleWorkspaceCosts(credentials, customerId, adminEmail);
}

/**
 * Collect yesterday's costs (same as current for license-based billing)
 */
async function collectYesterdayCosts(credentials, customerId, adminEmail) {
  return collectGoogleWorkspaceCosts(credentials, customerId, adminEmail);
}

module.exports = {
  collectGoogleWorkspaceCosts,
  collectCurrentMonthCosts,
  collectYesterdayCosts,
};
