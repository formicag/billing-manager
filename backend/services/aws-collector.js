// services/aws-collector.js - AWS Cost Explorer integration
const { CostExplorerClient, GetCostAndUsageCommand, GetCostForecastCommand } = require('@aws-sdk/client-cost-explorer');
const { BudgetsClient, DescribeBudgetsCommand } = require('@aws-sdk/client-budgets');

/**
 * Collect AWS costs for a given date range
 * @param {Object} credentials - AWS credentials
 * @param {string} credentials.accessKeyId - AWS access key
 * @param {string} credentials.secretAccessKey - AWS secret access key
 * @param {string} credentials.region - AWS region
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @returns {Promise<Object>} Cost data
 */
async function collectAWSCosts(credentials, startDate, endDate) {
  const { accessKeyId, secretAccessKey, region } = credentials;

  // Create Cost Explorer client
  const client = new CostExplorerClient({
    region: region || 'us-east-1',
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  try {
    // Query cost and usage data
    const command = new GetCostAndUsageCommand({
      TimePeriod: {
        Start: startDate,
        End: endDate,
      },
      Granularity: 'DAILY',
      Metrics: ['UnblendedCost'],
      GroupBy: [
        {
          Type: 'DIMENSION',
          Key: 'SERVICE',
        },
      ],
    });

    const response = await client.send(command);

    // Process the response
    const costs = [];

    if (response.ResultsByTime && response.ResultsByTime.length > 0) {
      for (const result of response.ResultsByTime) {
        const timestamp = result.TimePeriod.Start;
        let totalCost = 0;
        const resources = [];

        // Process each service
        if (result.Groups && result.Groups.length > 0) {
          for (const group of result.Groups) {
            const serviceName = group.Keys[0];
            const cost = parseFloat(group.Metrics.UnblendedCost.Amount);

            totalCost += cost;

            if (cost > 0) {
              resources.push({
                resourceId: serviceName,
                name: serviceName,
                type: 'AWS Service',
                cost: cost,
                tags: {},
              });
            }
          }
        } else if (result.Total) {
          // If no grouping, use total
          totalCost = parseFloat(result.Total.UnblendedCost.Amount);
        }

        costs.push({
          serviceId: 'aws',
          timestamp: new Date(timestamp).toISOString(),
          totalCost: totalCost,
          currency: 'USD',
          resources: resources,
          metadata: {
            granularity: 'DAILY',
            source: 'AWS Cost Explorer',
          },
        });
      }
    }

    return {
      success: true,
      costs,
      count: costs.length,
    };
  } catch (error) {
    console.error('Error fetching AWS costs:', error);
    throw new Error(`AWS Cost Explorer error: ${error.message}`);
  }
}

/**
 * Get AWS Cost Forecast for the current month
 */
async function getAWSForecast(credentials) {
  const { accessKeyId, secretAccessKey, region, accountId } = credentials;

  const client = new CostExplorerClient({
    region: region || 'us-east-1',
    credentials: { accessKeyId, secretAccessKey },
  });

  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const command = new GetCostForecastCommand({
      TimePeriod: {
        Start: startOfMonth.toISOString().split('T')[0],
        End: endOfMonth.toISOString().split('T')[0],
      },
      Metric: 'UNBLENDED_COST',
      Granularity: 'MONTHLY',
    });

    const response = await client.send(command);

    if (response.Total && response.Total.Amount) {
      return {
        forecastedAmount: parseFloat(response.Total.Amount),
        currency: response.Total.Unit || 'USD',
      };
    }
    return null;
  } catch (error) {
    console.error('Error fetching AWS forecast:', error);
    return null;
  }
}

/**
 * Get AWS Budgets
 */
async function getAWSBudgets(credentials) {
  const { accessKeyId, secretAccessKey, region, accountId } = credentials;

  if (!accountId) {
    console.warn('AWS Account ID not provided, skipping budget collection');
    return [];
  }

  const client = new BudgetsClient({
    region: region || 'us-east-1',
    credentials: { accessKeyId, secretAccessKey },
  });

  try {
    const command = new DescribeBudgetsCommand({
      AccountId: accountId,
    });

    const response = await client.send(command);

    if (response.Budgets && response.Budgets.length > 0) {
      return response.Budgets.map(budget => ({
        budgetName: budget.BudgetName,
        budgetLimit: parseFloat(budget.BudgetLimit.Amount),
        budgetType: budget.BudgetType,
        timeUnit: budget.TimeUnit,
        actualSpend: budget.CalculatedSpend?.ActualSpend
          ? parseFloat(budget.CalculatedSpend.ActualSpend.Amount)
          : 0,
        forecastedSpend: budget.CalculatedSpend?.ForecastedSpend
          ? parseFloat(budget.CalculatedSpend.ForecastedSpend.Amount)
          : 0,
        currency: budget.BudgetLimit.Unit || 'USD',
      }));
    }
    return [];
  } catch (error) {
    console.error('Error fetching AWS budgets:', error);
    return [];
  }
}

/**
 * Collect costs for the current month to date
 */
async function collectCurrentMonthCosts(credentials) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const startDate = startOfMonth.toISOString().split('T')[0];
  const endDate = tomorrow.toISOString().split('T')[0];

  // Collect costs, forecast, and budgets in parallel
  const [costsResult, forecast, budgets] = await Promise.all([
    collectAWSCosts(credentials, startDate, endDate),
    getAWSForecast(credentials),
    getAWSBudgets(credentials),
  ]);

  // Attach forecast and budgets to each cost entry
  if (forecast || budgets.length > 0) {
    costsResult.costs = costsResult.costs.map(cost => ({
      ...cost,
      forecast: forecast,
      budgets: budgets,
    }));
  }

  return costsResult;
}

/**
 * Collect costs for yesterday (most recent complete day)
 */
async function collectYesterdayCosts(credentials) {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const today = new Date();

  const startDate = yesterday.toISOString().split('T')[0];
  const endDate = today.toISOString().split('T')[0];

  return collectAWSCosts(credentials, startDate, endDate);
}

module.exports = {
  collectAWSCosts,
  collectCurrentMonthCosts,
  collectYesterdayCosts,
  getAWSForecast,
  getAWSBudgets,
};
