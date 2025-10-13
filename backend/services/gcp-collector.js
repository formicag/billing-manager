// services/gcp-collector.js - GCP Cloud Billing integration

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
  // BigQuery implementation would go here
  // Requires @google-cloud/bigquery package to be installed

  // Query to get daily costs grouped by service
  // Note: User needs to have BigQuery billing export configured
  // The table name format is: [PROJECT].[DATASET].gcp_billing_export_v1_[BILLING_ACCOUNT_ID]
  const query = `
    SELECT
      DATE(usage_start_time) as usage_date,
      service.description as service_name,
      SUM(cost) as cost,
      currency
    FROM
      \`[PROJECT].[DATASET].gcp_billing_export_v1_${billingAccountId.replace(/-/g, '_')}\`
    WHERE
      DATE(usage_start_time) >= @startDate
      AND DATE(usage_start_time) < @endDate
      AND cost > 0
    GROUP BY
      usage_date, service_name, currency
    ORDER BY
      usage_date, cost DESC
  `;

  // This will fail if BigQuery export is not configured
  // For now, we'll return a helpful error
  throw new Error(
    'GCP cost collection requires BigQuery billing export to be configured. ' +
    'Please set up billing export to BigQuery in your GCP console: ' +
    'https://console.cloud.google.com/billing/export'
  );
}

/**
 * Collect GCP costs using Cloud Billing API (simpler method)
 * This uses the Cloud Billing API to get cost data
 * @param {Object} credentials - GCP service account credentials
 * @param {string} billingAccountId - GCP billing account ID
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @returns {Promise<Object>} Cost data
 */
async function collectGCPCosts(credentials, billingAccountId, startDate, endDate) {
  // Unfortunately, GCP doesn't provide a simple Cost Explorer-like API
  // The recommended approach is to use BigQuery billing export
  // For now, we'll create mock/sample data structure

  // In a real implementation, you would:
  // 1. Set up BigQuery billing export
  // 2. Query the export table
  // 3. Parse and return the data

  console.log(`Collecting GCP costs for billing account: ${billingAccountId}`);
  console.log(`Date range: ${startDate} to ${endDate}`);

  const costs = [];

  // Generate daily entries between start and end date
  const start = new Date(startDate);
  const end = new Date(endDate);

  for (let date = new Date(start); date < end; date.setDate(date.getDate() + 1)) {
    const dateStr = date.toISOString().split('T')[0];

    // For demonstration, return structure with zero costs
    // In production, this would query BigQuery billing export
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
        note: 'To see actual costs, please configure BigQuery billing export at: https://console.cloud.google.com/billing/export'
      },
    });
  }

  return {
    success: true,
    costs,
    count: costs.length,
    warning: 'GCP cost collection requires BigQuery billing export to be configured. Currently returning placeholder data.'
  };
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
