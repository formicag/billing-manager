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

    // Try to get actual usage data from OpenAI API
    let totalCost = 0;
    const resources = [];
    const usageByModel = {};

    try {
      // Get usage for the last 30 days
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);

      // OpenAI usage API requires checking each day individually
      const promises = [];
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        promises.push(
          axios.get(`https://api.openai.com/v1/usage?date=${dateStr}`, { headers })
            .then(response => ({ date: dateStr, data: response.data }))
            .catch(error => {
              console.log(`Could not fetch usage for ${dateStr}:`, error.message);
              return { date: dateStr, data: null };
            })
        );
      }

      const results = await Promise.all(promises);

      // Process usage data
      for (const result of results) {
        if (!result.data || !result.data.data) continue;

        for (const usage of result.data.data) {
          const modelId = usage.snapshot_id || 'unknown';
          const inputTokens = usage.n_context_tokens_total || 0;
          const outputTokens = usage.n_generated_tokens_total || 0;

          if (!usageByModel[modelId]) {
            usageByModel[modelId] = {
              inputTokens: 0,
              outputTokens: 0
            };
          }

          usageByModel[modelId].inputTokens += inputTokens;
          usageByModel[modelId].outputTokens += outputTokens;
        }
      }

      console.log(`Found usage for ${Object.keys(usageByModel).length} models`);
    } catch (error) {
      console.log('Could not fetch usage data:', error.message);
    }

    // Calculate costs from actual usage
    if (Object.keys(usageByModel).length > 0) {
      for (const [modelId, usage] of Object.entries(usageByModel)) {
        // Try to match model ID to pricing (use gpt-4o-mini as default for unknown)
        const pricing = modelPricing[modelId] || modelPricing['gpt-4o-mini'];

        const inputCost = (usage.inputTokens / 1000) * pricing.input;
        const outputCost = (usage.outputTokens / 1000) * pricing.output;
        const modelCost = inputCost + outputCost;

        totalCost += modelCost;

        resources.push({
          resourceId: modelId,
          name: pricing.name || modelId,
          type: 'OpenAI Model',
          cost: modelCost,
          tags: {
            model: modelId,
            inputTokens: usage.inputTokens.toString(),
            outputTokens: usage.outputTokens.toString(),
            inputCostPer1K: pricing.input.toString(),
            outputCostPer1K: pricing.output.toString(),
            source: 'OpenAI Usage API'
          }
        });
      }
    } else {
      // No usage found - add a $0 placeholder
      console.log('No usage found in the last 30 days');
      resources.push({
        resourceId: 'no-usage',
        name: 'No Usage',
        type: 'OpenAI Model',
        cost: 0,
        tags: {
          note: 'No API usage detected in the last 30 days. Check OpenAI dashboard for details.'
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
        source: 'OpenAI Usage API',
        note: totalCost === 0
          ? 'No API usage detected in the last 30 days. Costs shown are actual usage from OpenAI API.'
          : 'Costs calculated from actual API usage in the last 30 days.',
        modelCount: resources.length,
        dashboardUrl: 'https://platform.openai.com/usage',
        last30Days: true
      }
    }];

    return {
      success: true,
      costs,
      count: costs.length,
      warning: totalCost === 0
        ? 'No OpenAI API usage detected in the last 30 days. If you have usage, check your OpenAI dashboard.'
        : undefined,
      summary: {
        totalModels: resources.length,
        actualMonthlyCost: totalCost,
        last30DaysUsage: true
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
