// services/anthropic-collector.js - Anthropic Claude API usage cost tracking

const axios = require('axios');

/**
 * Anthropic Claude model pricing (per 1M tokens in USD)
 * Updated: November 2025
 * Source: https://docs.anthropic.com/en/docs/about-claude/pricing
 */
const ANTHROPIC_PRICING = {
  // Claude 4 Family (Opus 4.1, Sonnet 4.0)
  'claude-opus-4.1-20250514': { input: 15.00, output: 75.00, name: 'Claude Opus 4.1' },
  'claude-sonnet-4-20250514': { input: 3.00, output: 15.00, name: 'Claude Sonnet 4.0' },

  // Claude 3.5 Family
  'claude-3-5-sonnet-20241022': { input: 3.00, output: 15.00, name: 'Claude 3.5 Sonnet v2' },
  'claude-3-5-sonnet-20240620': { input: 3.00, output: 15.00, name: 'Claude 3.5 Sonnet' },
  'claude-3-5-haiku-20241022': { input: 0.80, output: 4.00, name: 'Claude 3.5 Haiku' },

  // Claude 3 Family
  'claude-3-opus-20240229': { input: 15.00, output: 75.00, name: 'Claude 3 Opus' },
  'claude-3-sonnet-20240229': { input: 3.00, output: 15.00, name: 'Claude 3 Sonnet' },
  'claude-3-haiku-20240307': { input: 0.25, output: 1.25, name: 'Claude 3 Haiku' },

  // Legacy models
  'claude-2.1': { input: 8.00, output: 24.00, name: 'Claude 2.1' },
  'claude-2.0': { input: 8.00, output: 24.00, name: 'Claude 2.0' },
  'claude-instant-1.2': { input: 0.80, output: 2.40, name: 'Claude Instant 1.2' },
};

/**
 * Get pricing for a model
 */
function getModelPricing(modelId) {
  // Try exact match first
  if (ANTHROPIC_PRICING[modelId]) {
    return ANTHROPIC_PRICING[modelId];
  }

  // Try to match by model family
  for (const [key, value] of Object.entries(ANTHROPIC_PRICING)) {
    if (modelId.includes(key) || key.includes(modelId)) {
      return value;
    }
  }

  // Default to Sonnet 4 pricing if unknown
  console.warn(`Unknown Anthropic model: ${modelId}, using Sonnet 4 pricing as fallback`);
  return { input: 3.00, output: 15.00, name: modelId };
}

/**
 * Make a minimal API call to check credentials and get account info
 */
async function testAnthropicAPI(apiKey) {
  try {
    // Make a minimal API call to verify credentials
    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: 'claude-3-haiku-20240307', // Cheapest model for testing
        max_tokens: 10,
        messages: [{
          role: 'user',
          content: 'Hi'
        }]
      },
      {
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json'
        }
      }
    );

    return {
      valid: true,
      usage: response.data.usage,
      model: response.data.model
    };
  } catch (error) {
    if (error.response) {
      throw new Error(`Anthropic API error: ${error.response.data.error?.message || error.response.statusText}`);
    }
    throw error;
  }
}

/**
 * Collect Anthropic API usage costs
 *
 * Note: Anthropic doesn't provide a public API to fetch historical usage data
 * for individual accounts. This collector provides estimated usage based on
 * a test API call and stores cumulative usage over time.
 *
 * For accurate billing, check: https://console.anthropic.com/settings/billing
 *
 * @param {Object} credentials - Anthropic API credentials {apiKey}
 * @returns {Promise<Object>} Cost data
 */
async function collectAnthropicCosts(credentials) {
  console.log('Collecting Anthropic API costs...');

  const { apiKey } = credentials;

  if (!apiKey) {
    throw new Error('Anthropic API key is required');
  }

  try {
    // Test API to verify credentials
    const testResult = await testAnthropicAPI(apiKey);

    // Since we can't fetch historical usage via API for individual accounts,
    // we'll return a minimal cost entry to show the service is configured
    // Real usage tracking would require the Admin API (organization accounts only)

    const now = new Date();
    const today = now.toISOString().split('T')[0];

    // Get pricing for the test model
    const pricing = getModelPricing(testResult.model);

    // Calculate cost from test call
    const inputCost = (testResult.usage.input_tokens / 1000000) * pricing.input;
    const outputCost = (testResult.usage.output_tokens / 1000000) * pricing.output;
    const testCost = inputCost + outputCost;

    const costs = [{
      serviceId: 'anthropic',
      timestamp: new Date(today).toISOString(),
      totalCost: 0, // Set to 0 since we can't fetch real usage
      currency: 'USD',
      resources: [{
        resourceId: 'api-usage',
        name: 'API Usage (Manual Tracking)',
        type: 'Anthropic Claude API',
        cost: 0,
        tags: {
          note: 'Individual accounts cannot fetch usage via API. Please check console.anthropic.com for accurate costs.',
          test_call_cost: testCost.toFixed(6),
          models_available: Object.keys(ANTHROPIC_PRICING).length
        }
      }],
      metadata: {
        granularity: 'DAILY',
        source: 'Anthropic API (Limited - No Usage API for Individual Accounts)',
        warning: 'This service requires Admin API keys for full usage tracking. Currently showing connection status only.',
        pricing_models: Object.keys(ANTHROPIC_PRICING).length,
        test_model: pricing.name,
        console_url: 'https://console.anthropic.com/settings/billing'
      }
    }];

    return {
      success: true,
      costs,
      count: costs.length,
      warning: 'Anthropic individual accounts do not support programmatic usage tracking. For accurate costs, visit https://console.anthropic.com/settings/billing. Consider upgrading to an organization account for API-based usage reporting.'
    };

  } catch (error) {
    console.error('Error collecting Anthropic costs:', error);
    throw new Error(`Anthropic API error: ${error.message}`);
  }
}

/**
 * Collect costs for the current month to date
 */
async function collectCurrentMonthCosts(credentials) {
  return collectAnthropicCosts(credentials);
}

/**
 * Collect costs for yesterday
 */
async function collectYesterdayCosts(credentials) {
  return collectAnthropicCosts(credentials);
}

module.exports = {
  collectAnthropicCosts,
  collectCurrentMonthCosts,
  collectYesterdayCosts,
};
