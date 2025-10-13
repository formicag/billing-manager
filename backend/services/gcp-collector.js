// services/gcp-collector.js - GCP Cloud Billing integration
const { BigQuery } = require('@google-cloud/bigquery');

/**
 * Collect GCP costs for a given date range using BigQuery export
 * Note: This requires Cloud Billing export to BigQuery to be set up
 * @param {Object} credentials - GCP service account credentials
 * @param {string} billingAccountId - GCP billing account ID
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @returns {Promise<Object>} Cost data
 */
async function collectGCPCostsFromBigQuery(credentials, billingAccountId, startDate, endDate) {
  const bigquery = new BigQuery({
    credentials,
    projectId: credentials.project_id,
  });

  // The billing export table name format
  const projectId = credentials.project_id;
  const datasetId = 'billing_data';
  const tableId = `gcp_billing_export_v1_${billingAccountId.replace(/-/g, '_')}`;
  const tableRef = `${projectId}.${datasetId}.${tableId}`;

  // Query to get daily costs grouped by service
  const query = `
    SELECT
      DATE(usage_start_time) as usage_date,
      service.description as service_name,
      sku.description as sku_description,
      SUM(cost) as cost,
      currency
    FROM
      \`${tableRef}\`
    WHERE
      DATE(usage_start_time) >= @startDate
      AND DATE(usage_start_time) < @endDate
      AND cost > 0
    GROUP BY
      usage_date, service_name, sku_description, currency
    ORDER BY
      usage_date, service_name, cost DESC
  `;

  const options = {
    query: query,
    params: {
      startDate: startDate,
      endDate: endDate,
    },
    location: 'US',
  };

  try {
    const [rows] = await bigquery.query(options);

    // Group by date
    const costsByDate = {};

    rows.forEach(row => {
      const dateStr = row.usage_date.value; // BigQuery returns date as object
      if (!costsByDate[dateStr]) {
        costsByDate[dateStr] = {
          totalCost: 0,
          currency: row.currency,
          resources: [],
        };
      }

      costsByDate[dateStr].totalCost += row.cost;
      costsByDate[dateStr].resources.push({
        resourceId: row.service_name,
        name: row.service_name,
        type: 'GCP Service',
        cost: row.cost,
        tags: {
          sku: row.sku_description,
        },
      });
    });

    // Convert to array format
    const costs = [];
    for (const [dateStr, data] of Object.entries(costsByDate)) {
      costs.push({
        serviceId: 'gcp',
        timestamp: new Date(dateStr).toISOString(),
        totalCost: data.totalCost,
        currency: data.currency,
        resources: data.resources,
        metadata: {
          granularity: 'DAILY',
          source: 'GCP BigQuery Billing Export',
          billingAccountId: billingAccountId,
        },
      });
    }

    return {
      success: true,
      costs,
      count: costs.length,
    };
  } catch (error) {
    // If the table doesn't exist or query fails, return helpful error
    if (error.message.includes('Not found: Table') || error.message.includes('not found')) {
      throw new Error(
        `BigQuery billing export table not found. Please configure billing export:\n` +
        `1. Go to: https://console.cloud.google.com/billing/${billingAccountId}/export\n` +
        `2. Click "Edit settings" for BigQuery Export\n` +
        `3. Set Project: ${projectId}\n` +
        `4. Set Dataset: ${datasetId}\n` +
        `5. Wait 24-48 hours for data to populate`
      );
    }
    throw error;
  }
}

/**
 * Collect GCP costs - tries BigQuery first, falls back to placeholder
 * @param {Object} credentials - GCP service account credentials
 * @param {string} billingAccountId - GCP billing account ID
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @returns {Promise<Object>} Cost data
 */
async function collectGCPCosts(credentials, billingAccountId, startDate, endDate) {
  console.log(`Collecting GCP costs for billing account: ${billingAccountId}`);
  console.log(`Date range: ${startDate} to ${endDate}`);

  try {
    // Try to collect from BigQuery export first
    return await collectGCPCostsFromBigQuery(credentials, billingAccountId, startDate, endDate);
  } catch (error) {
    console.log('BigQuery collection failed, returning placeholder data:', error.message);

    // Fall back to placeholder data
    const costs = [];
    const start = new Date(startDate);
    const end = new Date(endDate);

    for (let date = new Date(start); date < end; date.setDate(date.getDate() + 1)) {
      const dateStr = date.toISOString().split('T')[0];

      costs.push({
        serviceId: 'gcp',
        timestamp: new Date(dateStr).toISOString(),
        totalCost: 0,
        currency: 'USD',
        resources: [],
        metadata: {
          granularity: 'DAILY',
          source: 'GCP Cloud Billing (requires BigQuery export)',
          billingAccountId: billingAccountId,
          note: error.message || 'To see actual costs, please configure BigQuery billing export'
        },
      });
    }

    return {
      success: true,
      costs,
      count: costs.length,
      warning: error.message || 'GCP cost collection requires BigQuery billing export to be configured. Currently returning placeholder data.'
    };
  }
}

/**
 * Collect costs for the current month to date
 */
async function collectCurrentMonthCosts(credentials, billingAccountId) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const startDate = startOfMonth.toISOString().split('T')[0];
  const endDate = tomorrow.toISOString().split('T')[0];

  return collectGCPCosts(credentials, billingAccountId, startDate, endDate);
}

/**
 * Collect costs for yesterday (most recent complete day)
 */
async function collectYesterdayCosts(credentials, billingAccountId) {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const today = new Date();

  const startDate = yesterday.toISOString().split('T')[0];
  const endDate = today.toISOString().split('T')[0];

  return collectGCPCosts(credentials, billingAccountId, startDate, endDate);
}

module.exports = {
  collectGCPCosts,
  collectCurrentMonthCosts,
  collectYesterdayCosts,
};
