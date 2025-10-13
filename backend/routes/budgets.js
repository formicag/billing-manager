// routes/budgets.js - Budget and alert management endpoints
const express = require('express');
const router = express.Router();

// GET /api/budgets - Get all budgets across all services
router.get('/', async (req, res) => {
  try {
    const firestore = req.app.locals.firestore;

    // Get all configured services with credentials
    const credSnapshot = await firestore.collection('credentials').get();
    const allBudgets = [];

    for (const credDoc of credSnapshot.docs) {
      const serviceId = credDoc.id;

      try {
        // Fetch budgets for this service
        const budgets = await fetchBudgetsForService(serviceId, req.app.locals);
        allBudgets.push(...budgets);
      } catch (error) {
        console.error(`Error fetching budgets for ${serviceId}:`, error);
        // Continue with other services even if one fails
      }
    }

    res.json({
      budgets: allBudgets,
      count: allBudgets.length
    });
  } catch (error) {
    console.error('Error fetching budgets:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/budgets/:serviceId - Get budgets for a specific service
router.get('/:serviceId', async (req, res) => {
  try {
    const { serviceId } = req.params;
    const budgets = await fetchBudgetsForService(serviceId, req.app.locals);

    res.json({
      serviceId,
      budgets,
      count: budgets.length
    });
  } catch (error) {
    console.error(`Error fetching budgets for ${req.params.serviceId}:`, error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Fetch budgets for a specific service
 */
async function fetchBudgetsForService(serviceId, appLocals) {
  const { firestore, secretManager, projectId } = appLocals;

  // Check if credentials exist
  const credDoc = await firestore.collection('credentials').doc(serviceId).get();
  if (!credDoc.exists) {
    return [];
  }

  const credData = credDoc.data();

  if (serviceId === 'aws') {
    return fetchAWSBudgets(credData, secretManager, projectId);
  } else if (serviceId === 'gcp') {
    return fetchGCPBudgets(credData, secretManager, projectId);
  }

  return [];
}

/**
 * Fetch AWS budgets using AWS Budgets API
 */
async function fetchAWSBudgets(credData, secretManager, projectId) {
  const { BudgetsClient, DescribeBudgetsCommand } = require('@aws-sdk/client-budgets');

  // Get AWS credentials from Secret Manager
  const { secretName } = credData;
  const [version] = await secretManager.accessSecretVersion({
    name: `projects/${projectId}/secrets/${secretName}/versions/latest`
  });
  const credentials = JSON.parse(version.payload.data.toString('utf8'));

  const client = new BudgetsClient({
    region: credentials.region || 'us-east-1',
    credentials: {
      accessKeyId: credentials.accessKeyId,
      secretAccessKey: credentials.secretAccessKey,
    },
  });

  // AWS requires account ID for budgets
  // We'll need to get it using STS
  const { STSClient, GetCallerIdentityCommand } = require('@aws-sdk/client-sts');
  const stsClient = new STSClient({
    region: credentials.region || 'us-east-1',
    credentials: {
      accessKeyId: credentials.accessKeyId,
      secretAccessKey: credentials.secretAccessKey,
    },
  });

  const identity = await stsClient.send(new GetCallerIdentityCommand({}));
  const accountId = identity.Account;

  const command = new DescribeBudgetsCommand({
    AccountId: accountId,
  });

  const response = await client.send(command);
  const budgets = [];

  if (response.Budgets) {
    for (const budget of response.Budgets) {
      const thresholds = [];

      // Extract notification thresholds
      if (budget.NotificationsWithSubscribers) {
        for (const notif of budget.NotificationsWithSubscribers) {
          thresholds.push({
            threshold: notif.Notification.Threshold,
            thresholdType: notif.Notification.ThresholdType,
            comparisonOperator: notif.Notification.ComparisonOperator,
            notificationType: notif.Notification.NotificationType,
            subscribers: notif.Subscribers.map(sub => ({
              type: sub.SubscriptionType,
              address: sub.Address
            }))
          });
        }
      }

      budgets.push({
        serviceId: 'aws',
        budgetName: budget.BudgetName,
        budgetLimit: {
          amount: parseFloat(budget.BudgetLimit?.Amount || 0),
          currency: budget.BudgetLimit?.Unit || 'USD'
        },
        timeUnit: budget.TimeUnit,
        budgetType: budget.BudgetType,
        calculatedSpend: {
          actualSpend: parseFloat(budget.CalculatedSpend?.ActualSpend?.Amount || 0),
          forecastedSpend: parseFloat(budget.CalculatedSpend?.ForecastedSpend?.Amount || 0)
        },
        thresholds,
        timePeriod: {
          start: budget.TimePeriod?.Start,
          end: budget.TimePeriod?.End
        }
      });
    }
  }

  return budgets;
}

/**
 * Fetch GCP budgets using Cloud Billing Budget API
 */
async function fetchGCPBudgets(credData, secretManager, projectId) {
  const { BudgetServiceClient } = require('@google-cloud/billing-budgets');

  // Get GCP credentials from Secret Manager
  const { secretName, billingAccountId } = credData;
  const [version] = await secretManager.accessSecretVersion({
    name: `projects/${projectId}/secrets/${secretName}/versions/latest`
  });
  const credentials = JSON.parse(version.payload.data.toString('utf8'));

  const client = new BudgetServiceClient({
    credentials,
  });

  const [budgetsList] = await client.listBudgets({
    parent: `billingAccounts/${billingAccountId}`,
  });

  const budgets = [];

  for (const budget of budgetsList) {
    const amount = budget.amount?.specifiedAmount
      ? {
          amount: parseFloat(budget.amount.specifiedAmount.units || 0),
          currency: budget.amount.specifiedAmount.currencyCode || 'USD'
        }
      : null;

    const thresholds = (budget.thresholdRules || []).map(rule => ({
      threshold: rule.thresholdPercent * 100, // Convert to percentage
      spendBasis: rule.spendBasis
    }));

    // Extract notification channels
    const notificationChannels = budget.notificationsRule?.monitoringNotificationChannels || [];

    budgets.push({
      serviceId: 'gcp',
      budgetName: budget.displayName || 'Unnamed Budget',
      budgetLimit: amount,
      calendarPeriod: budget.budgetFilter?.calendarPeriod,
      thresholds,
      notificationChannels,
      disableDefaultIamRecipients: budget.notificationsRule?.disableDefaultIamRecipients || false,
      pubsubTopic: budget.notificationsRule?.pubsubTopic,
      schemaVersion: budget.notificationsRule?.schemaVersion
    });
  }

  return budgets;
}

module.exports = router;
