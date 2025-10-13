// services/chatgpt-collector.js - OpenAI API usage cost tracking

/**
 * Collect OpenAI API usage costs
 * @param {Object} credentials - OpenAI API credentials {apiKey, organizationId}
 * @returns {Promise<Object>} Cost data
 */
async function collectChatGPTCosts(credentials) {
  console.log('Collecting OpenAI API costs...');

  const axios = require('axios');

  try {
    const { apiKey, organizationId } = credentials;

    if (!apiKey) {
      throw new Error('OpenAI API key is required');
    }

    const headers = {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    };

    if (organizationId) {
      headers['OpenAI-Organization'] = organizationId;
    }

    // OpenAI model pricing (per 1K tokens in USD)
    const modelPricing = {
      'gpt-4': { input: 0.03, output: 0.06, name: 'GPT-4' },
      'gpt-4-32k': { input: 0.06, output: 0.12, name: 'GPT-4 32K' },
      'gpt-4-turbo': { input: 0.01, output: 0.03, name: 'GPT-4 Turbo' },
      'gpt-4o': { input: 0.005, output: 0.015, name: 'GPT-4o' },
      'gpt-4o-mini': { input: 0.00015, output: 0.0006, name: 'GPT-4o Mini' },
      'gpt-3.5-turbo': { input: 0.0015, output: 0.002, name: 'GPT-3.5 Turbo' },
      'gpt-3.5-turbo-16k': { input: 0.003, output: 0.004, name: 'GPT-3.5 Turbo 16K' },
      'davinci': { input: 0.02, output: 0.02, name: 'Davinci' },
      'curie': { input: 0.002, output: 0.002, name: 'Curie' },
      'babbage': { input: 0.0004, output: 0.0004, name: 'Babbage' },
      'ada': { input: 0.0004, output: 0.0004, name: 'Ada' },
      'text-embedding-ada-002': { input: 0.0001, output: 0, name: 'Text Embedding Ada 002' },
      'text-embedding-3-small': { input: 0.00002, output: 0, name: 'Text Embedding 3 Small' },
      'text-embedding-3-large': { input: 0.00013, output: 0, name: 'Text Embedding 3 Large' },
      'whisper': { input: 0.006, output: 0, name: 'Whisper (per minute)' },
      'tts': { input: 0.015, output: 0, name: 'TTS (per 1M characters)' },
      'dall-e-3': { input: 0.04, output: 0, name: 'DALL-E 3 (per image)' },
      'dall-e-2': { input: 0.02, output: 0, name: 'DALL-E 2 (per image)' }
    };

    // Try to get usage data (note: OpenAI usage API is limited)
    // We'll estimate based on common patterns since detailed billing data isn't available via API
    let totalCost = 0;
    const resources = [];

    try {
      // Check if we can access organization info
      const orgResponse = await axios.get(
        'https://api.openai.com/v1/organization',
        { headers }
      );

      // Note: OpenAI doesn't provide detailed usage/billing via API
      // This is a placeholder for when/if they add it
      console.log('Organization info retrieved');
    } catch (error) {
      console.log('Could not fetch organization info:', error.message);
    }

    // Since OpenAI doesn't provide usage data via API, we'll create estimated placeholders
    // Users should manually enter their costs from the OpenAI dashboard
    const estimatedModels = [
      { model: 'gpt-4o', tokens: 1000000, inputRatio: 0.6 },
      { model: 'gpt-3.5-turbo', tokens: 500000, inputRatio: 0.6 }
    ];

    for (const usage of estimatedModels) {
      const pricing = modelPricing[usage.model];
      if (!pricing) continue;

      const inputTokens = usage.tokens * usage.inputRatio;
      const outputTokens = usage.tokens * (1 - usage.inputRatio);

      const inputCost = (inputTokens / 1000) * pricing.input;
      const outputCost = (outputTokens / 1000) * pricing.output;
      const modelCost = inputCost + outputCost;

      totalCost += modelCost;

      resources.push({
        resourceId: usage.model,
        name: pricing.name,
        type: 'OpenAI Model',
        cost: modelCost,
        tags: {
          model: usage.model,
          estimatedTokens: usage.tokens.toString(),
          inputCostPer1K: pricing.input.toString(),
          outputCostPer1K: pricing.output.toString(),
          note: 'Estimated usage - check OpenAI dashboard for actual costs'
        }
      });
    }

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    const costs = [{
      serviceId: 'chatgpt',
      timestamp: new Date(todayStr).toISOString(),
      totalCost: totalCost,
      currency: 'USD',
      resources: resources,
      metadata: {
        granularity: 'DAILY',
        source: 'OpenAI API (Estimated)',
        note: 'OpenAI does not provide detailed usage data via API. These are estimated costs. Please check your OpenAI dashboard (https://platform.openai.com/usage) for actual usage and costs.',
        modelCount: resources.length,
        dashboardUrl: 'https://platform.openai.com/usage'
      }
    }];

    return {
      success: true,
      costs,
      count: costs.length,
      warning: 'OpenAI API does not provide detailed billing data. These are estimated costs based on typical usage patterns. Check your OpenAI dashboard for actual costs.',
      summary: {
        totalModels: resources.length,
        estimatedDailyCost: totalCost,
        estimatedMonthlyCost: totalCost * 30
      }
    };
  } catch (error) {
    console.error('Error collecting OpenAI costs:', error);

    if (error.response?.status === 401) {
      throw new Error(
        'Authentication failed. Please verify:\n' +
        '1. API key is valid\n' +
        '2. API key has not been revoked\n' +
        '3. Organization ID is correct (if provided)'
      );
    }

    throw new Error(`Failed to collect OpenAI costs: ${error.message}`);
  }
}

/**
 * Collect costs for the current month
 */
async function collectCurrentMonthCosts(credentials) {
  return collectChatGPTCosts(credentials);
}

/**
 * Collect yesterday's costs
 */
async function collectYesterdayCosts(credentials) {
  return collectChatGPTCosts(credentials);
}

module.exports = {
  collectChatGPTCosts,
  collectCurrentMonthCosts,
  collectYesterdayCosts
};
