// services/cohere-collector.js - Cohere API usage cost tracking

/**
 * Collect Cohere API usage costs
 * @param {Object} credentials - Cohere API credentials {apiKey}
 * @returns {Promise<Object>} Cost data
 */
async function collectCohereCosts(credentials) {
  console.log('Collecting Cohere API costs...');

  const axios = require('axios');

  try {
    const { apiKey } = credentials;

    if (!apiKey) {
      throw new Error('Cohere API key is required');
    }

    const headers = {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    };

    // Cohere model pricing (per 1M tokens in USD)
    const modelPricing = {
      'command': { input: 1.0, output: 2.0, name: 'Command' },
      'command-light': { input: 0.3, output: 0.6, name: 'Command Light' },
      'command-r': { input: 0.5, output: 1.5, name: 'Command R' },
      'command-r-plus': { input: 3.0, output: 15.0, name: 'Command R+' },
      'embed-english-v3.0': { input: 0.1, output: 0, name: 'Embed English v3.0' },
      'embed-multilingual-v3.0': { input: 0.1, output: 0, name: 'Embed Multilingual v3.0' },
      'embed-english-light-v3.0': { input: 0.1, output: 0, name: 'Embed English Light v3.0' },
      'embed-multilingual-light-v3.0': { input: 0.1, output: 0, name: 'Embed Multilingual Light v3.0' },
      'rerank-english-v3.0': { input: 2.0, output: 0, name: 'Rerank English v3.0' },
      'rerank-multilingual-v3.0': { input: 2.0, output: 0, name: 'Rerank Multilingual v3.0' }
    };

    let totalCost = 0;
    const resources = [];

    // Try to verify the API key is valid
    try {
      await axios.post(
        'https://api.cohere.ai/v1/check-api-key',
        {},
        { headers }
      );
      console.log('Cohere API key is valid');
    } catch (error) {
      if (error.response?.status === 401) {
        throw new Error('Invalid Cohere API key');
      }
      console.log('Could not verify API key:', error.message);
    }

    // Note: Cohere doesn't provide detailed usage/billing via API
    // We'll create estimated placeholders based on typical usage
    const estimatedModels = [
      { model: 'command-r', tokens: 500000, inputRatio: 0.7 },
      { model: 'embed-english-v3.0', tokens: 1000000, inputRatio: 1.0 }
    ];

    for (const usage of estimatedModels) {
      const pricing = modelPricing[usage.model];
      if (!pricing) continue;

      const inputTokens = usage.tokens * usage.inputRatio;
      const outputTokens = usage.tokens * (1 - usage.inputRatio);

      const inputCost = (inputTokens / 1000000) * pricing.input;
      const outputCost = (outputTokens / 1000000) * pricing.output;
      const modelCost = inputCost + outputCost;

      totalCost += modelCost;

      resources.push({
        resourceId: usage.model,
        name: pricing.name,
        type: 'Cohere Model',
        cost: modelCost,
        tags: {
          model: usage.model,
          estimatedTokens: usage.tokens.toString(),
          inputCostPer1M: pricing.input.toString(),
          outputCostPer1M: pricing.output.toString(),
          note: 'Estimated usage - check Cohere dashboard for actual costs'
        }
      });
    }

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    const costs = [{
      serviceId: 'cohere',
      timestamp: new Date(todayStr).toISOString(),
      totalCost: totalCost,
      currency: 'USD',
      resources: resources,
      metadata: {
        granularity: 'DAILY',
        source: 'Cohere API (Estimated)',
        note: 'Cohere does not provide detailed usage data via API. These are estimated costs. Please check your Cohere dashboard (https://dashboard.cohere.com/billing) for actual usage and costs.',
        modelCount: resources.length,
        dashboardUrl: 'https://dashboard.cohere.com/billing'
      }
    }];

    return {
      success: true,
      costs,
      count: costs.length,
      warning: 'Cohere API does not provide detailed billing data. These are estimated costs based on typical usage patterns. Check your Cohere dashboard for actual costs.',
      summary: {
        totalModels: resources.length,
        estimatedDailyCost: totalCost,
        estimatedMonthlyCost: totalCost * 30
      }
    };
  } catch (error) {
    console.error('Error collecting Cohere costs:', error);

    if (error.response?.status === 401) {
      throw new Error(
        'Authentication failed. Please verify:\n' +
        '1. API key is valid\n' +
        '2. API key has not been revoked'
      );
    }

    throw new Error(`Failed to collect Cohere costs: ${error.message}`);
  }
}

/**
 * Collect costs for the current month
 */
async function collectCurrentMonthCosts(credentials) {
  return collectCohereCosts(credentials);
}

/**
 * Collect yesterday's costs
 */
async function collectYesterdayCosts(credentials) {
  return collectCohereCosts(credentials);
}

module.exports = {
  collectCohereCosts,
  collectCurrentMonthCosts,
  collectYesterdayCosts
};
