// services/atlassian-collector.js - Atlassian subscription cost tracking

/**
 * Collect Atlassian subscription costs
 * Note: Atlassian doesn't have a public billing API, so this estimates costs
 * based on product subscriptions and user counts
 * @param {Object} credentials - Atlassian API credentials {email, apiToken}
 * @returns {Promise<Object>} Cost data
 */
async function collectAtlassianCosts(credentials) {
  console.log('Collecting Atlassian costs...');

  const axios = require('axios');

  try {
    const { email, apiToken, cloudId } = credentials;

    if (!email || !apiToken) {
      throw new Error('Atlassian email and API token are required');
    }

    const auth = Buffer.from(`${email}:${apiToken}`).toString('base64');
    const headers = {
      'Authorization': `Basic ${auth}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    };

    // Get organization details
    let organizations = [];

    // If cloudId is provided, use it directly
    if (cloudId) {
      console.log(`Using provided Cloud ID: ${cloudId}`);
      organizations = [{ id: cloudId, name: 'Atlassian Organization' }];
    } else {
      // Otherwise, try to fetch all organizations
      try {
        const orgResponse = await axios.get(
          'https://api.atlassian.com/admin/v1/orgs',
          { headers }
        );
        organizations = orgResponse.data.data || [];
        console.log(`Found ${organizations.length} organizations`);
      } catch (error) {
        console.log('Could not fetch organizations:', error.message);
      }
    }

    // Atlassian product pricing (approximate monthly costs in USD)
    const productPricing = {
      'jira-software': { name: 'Jira Software', basePrice: 7.75, tier: 'Standard' },
      'jira-service-management': { name: 'Jira Service Management', basePrice: 20, tier: 'Standard' },
      'confluence': { name: 'Confluence', basePrice: 5.75, tier: 'Standard' },
      'bitbucket': { name: 'Bitbucket', basePrice: 3, tier: 'Standard' },
      'trello': { name: 'Trello', basePrice: 5, tier: 'Standard' },
      'statuspage': { name: 'Statuspage', basePrice: 29, tier: 'Starter' },
      'opsgenie': { name: 'Opsgenie', basePrice: 9, tier: 'Essentials' },
    };

    const resources = [];
    let totalMonthlyCost = 0;
    let userCount = 0;

    // If we have organization info, estimate based on that
    if (organizations.length > 0) {
      for (const org of organizations) {
        // Try to get products for this organization
        try {
          const productsResponse = await axios.get(
            `https://api.atlassian.com/admin/v1/orgs/${org.id}/products`,
            { headers }
          );

          const products = productsResponse.data.data || [];

          for (const product of products) {
            const productKey = product.productKey || 'unknown';
            const pricing = productPricing[productKey] || { name: productKey, basePrice: 10, tier: 'Standard' };

            // Get user count for this product
            let productUsers = 0;
            try {
              const usersResponse = await axios.get(
                `https://api.atlassian.com/admin/v1/orgs/${org.id}/users`,
                { headers, params: { product: productKey } }
              );
              productUsers = usersResponse.data.total || 10; // Default to 10 users if unavailable
            } catch (error) {
              productUsers = 10; // Default estimate
            }

            const productCost = pricing.basePrice * productUsers;
            totalMonthlyCost += productCost;
            userCount += productUsers;

            resources.push({
              resourceId: `${org.id}-${productKey}`,
              name: pricing.name,
              type: 'Atlassian Product',
              cost: productCost,
              tags: {
                organizationId: org.id,
                organizationName: org.name || 'Unknown',
                productKey: productKey,
                tier: pricing.tier,
                users: productUsers.toString(),
                pricePerUser: pricing.basePrice.toString()
              }
            });
          }
        } catch (error) {
          console.log(`Could not fetch products for org ${org.id}:`, error.message);
        }
      }
    }

    // If no data found, provide estimated costs based on common setup
    if (resources.length === 0) {
      // Default estimate: Jira Software + Confluence for 10 users
      const estimatedUsers = 10;
      const jiraCost = productPricing['jira-software'].basePrice * estimatedUsers;
      const confluenceCost = productPricing['confluence'].basePrice * estimatedUsers;
      totalMonthlyCost = jiraCost + confluenceCost;

      resources.push({
        resourceId: 'jira-software-estimated',
        name: 'Jira Software (Estimated)',
        type: 'Atlassian Product',
        cost: jiraCost,
        tags: {
          productKey: 'jira-software',
          tier: 'Standard',
          users: estimatedUsers.toString(),
          pricePerUser: productPricing['jira-software'].basePrice.toString(),
          note: 'Estimated - configure Cloud ID for accurate data'
        }
      });

      resources.push({
        resourceId: 'confluence-estimated',
        name: 'Confluence (Estimated)',
        type: 'Atlassian Product',
        cost: confluenceCost,
        tags: {
          productKey: 'confluence',
          tier: 'Standard',
          users: estimatedUsers.toString(),
          pricePerUser: productPricing['confluence'].basePrice.toString(),
          note: 'Estimated - configure Cloud ID for accurate data'
        }
      });
    }

    // Calculate daily cost
    const dailyCost = totalMonthlyCost / 30;

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    const costs = [{
      serviceId: 'atlassian',
      timestamp: new Date(todayStr).toISOString(),
      totalCost: dailyCost,
      currency: 'USD',
      resources: resources,
      metadata: {
        granularity: 'DAILY',
        source: 'Atlassian Admin API',
        totalOrganizations: organizations.length,
        totalProducts: resources.length,
        estimatedUsers: userCount || 10,
        estimatedMonthlyCost: totalMonthlyCost,
        note: 'Costs are estimated based on standard pricing. Actual costs may vary based on your subscription tier and billing terms.'
      }
    }];

    return {
      success: true,
      costs,
      count: costs.length,
      summary: {
        totalProducts: resources.length,
        totalUsers: userCount || 10,
        estimatedMonthlyCost: totalMonthlyCost,
        estimatedDailyCost: dailyCost
      }
    };
  } catch (error) {
    console.error('Error collecting Atlassian costs:', error);

    if (error.response?.status === 401 || error.response?.status === 403) {
      throw new Error(
        'Authentication failed. Please verify:\n' +
        '1. API token is valid\n' +
        '2. Email address is correct\n' +
        '3. Account has admin permissions'
      );
    }

    throw new Error(`Failed to collect Atlassian costs: ${error.message}`);
  }
}

/**
 * Collect costs for the current month
 */
async function collectCurrentMonthCosts(credentials) {
  return collectAtlassianCosts(credentials);
}

/**
 * Collect yesterday's costs (same as current for subscription-based billing)
 */
async function collectYesterdayCosts(credentials) {
  return collectAtlassianCosts(credentials);
}

module.exports = {
  collectAtlassianCosts,
  collectCurrentMonthCosts,
  collectYesterdayCosts
};
