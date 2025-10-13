# Quick Deployment Guide

Get Billing Manager running in 15-20 minutes.

## Prerequisites

- GCP account with billing enabled
- GitHub account
- Terminal with bash/zsh

## Step 1: Install Tools (2 minutes)

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Install gcloud SDK (if not already installed)
curl https://sdk.cloud.google.com | bash
exec -l $SHELL

# Login to GCP
gcloud auth login

# Login to Firebase
firebase login
```

## Step 2: Create GCP Project (3 minutes)

```bash
# Set variables
export PROJECT_ID="billing-manager-$(whoami)"
export REGION="europe-west2"
export GCP_BILLING_ACCOUNT="YOUR_BILLING_ACCOUNT_ID"  # Get from: gcloud billing accounts list

# Create project
gcloud projects create $PROJECT_ID --name="Billing Manager"
gcloud config set project $PROJECT_ID

# Link billing (REQUIRED)
gcloud billing projects link $PROJECT_ID --billing-account=$GCP_BILLING_ACCOUNT

# Enable APIs
gcloud services enable \
  run.googleapis.com \
  firestore.googleapis.com \
  secretmanager.googleapis.com \
  cloudscheduler.googleapis.com \
  cloudbuild.googleapis.com \
  firebase.googleapis.com \
  bigquery.googleapis.com \
  billingbudgets.googleapis.com

# Initialize Firestore
gcloud firestore databases create --location=$REGION
```

## Step 3: Initialize Firebase (2 minutes)

```bash
# Clone or navigate to your project
cd billing-manager

# Initialize Firebase
firebase init hosting --project $PROJECT_ID

# When prompted:
# - Public directory: frontend/build
# - Single-page app: Yes
# - Automatic builds: No
```

## Step 4: Create Service Account (2 minutes)

```bash
# Create service account
gcloud iam service-accounts create github-actions \
  --display-name="GitHub Actions"

# Grant permissions
for role in run.admin cloudbuild.builds.builder iam.serviceAccountUser firebase.admin storage.admin; do
  gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:github-actions@$PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/$role"
done

# Create key
gcloud iam service-accounts keys create ~/gcp-key.json \
  --iam-account=github-actions@$PROJECT_ID.iam.gserviceaccount.com

echo "Save this key for GitHub secrets:"
cat ~/gcp-key.json
```

## Step 5: Setup GitHub (3 minutes)

### Create Repository
1. Go to https://github.com/new
2. Name: `billing-manager`
3. Don't initialize with README

### Add Secrets
Go to: Repository → Settings → Secrets → New repository secret

Add these three secrets:

**GCP_SA_KEY**: [Paste entire content of ~/gcp-key.json]

**GCP_PROJECT**: [Your project ID, e.g., billing-manager-username]

**GCP_REGION**: europe-west2

## Step 6: Deploy (5 minutes)

```bash
cd billing-manager

# Initialize git (if not already)
git init

# Add remote
git remote add origin https://github.com/YOUR_USERNAME/billing-manager.git

# Commit and push
git add .
git commit -m "Initial deployment"
git branch -M main
git push -u origin main
```

This triggers automatic deployment via GitHub Actions.

## Step 7: Get URLs (1 minute)

```bash
# Wait for deployment (check: https://github.com/YOUR_USERNAME/billing-manager/actions)

# Get backend URL
gcloud run services describe billing-api --region=$REGION --format='value(status.url)'

# Get frontend URL
echo "https://$PROJECT_ID.web.app"
```

## Step 8: Configure First Service (5 minutes)

### AWS Setup

1. **Create AWS credentials** (if not already):
   - Go to AWS Console → IAM → Users
   - Create user with `ViewOnlyAccess` + `ce:GetCostAndUsage` policies
   - Generate access key

2. **Add to Billing Manager**:
   - Open frontend URL
   - Manually add AWS credentials via backend API:

```bash
export BACKEND_URL=$(gcloud run services describe billing-api --region=$REGION --format='value(status.url)')

# Create AWS credentials secret
echo '{
  "accessKeyId": "YOUR_AWS_ACCESS_KEY",
  "secretAccessKey": "YOUR_AWS_SECRET_KEY",
  "region": "us-east-1"
}' > /tmp/aws-creds.json

# Store in Secret Manager
gcloud secrets create aws-credentials --data-file=/tmp/aws-creds.json

# Grant access to compute service account
gcloud secrets add-iam-policy-binding aws-credentials \
  --member="serviceAccount:$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# Register in Firestore
curl -X POST "$BACKEND_URL/api/credentials/aws" \
  -H "Content-Type: application/json" \
  -d '{
    "credentials": {
      "accessKeyId": "YOUR_AWS_ACCESS_KEY",
      "secretAccessKey": "YOUR_AWS_SECRET_KEY",
      "region": "us-east-1"
    },
    "credentialType": "access-key"
  }'

# Trigger cost collection
curl -X POST "$BACKEND_URL/api/costs/collect" \
  -H "Content-Type: application/json" \
  -d '{"serviceId": "aws"}'
```

### GCP Setup

```bash
# Create service account for billing
gcloud iam service-accounts create gcp-billing-reader \
  --display-name="GCP Billing Reader"

# Grant billing viewer permission
gcloud billing accounts add-iam-policy-binding $GCP_BILLING_ACCOUNT \
  --member="serviceAccount:gcp-billing-reader@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/billing.viewer"

# Grant BigQuery permissions
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:gcp-billing-reader@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/bigquery.dataViewer"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:gcp-billing-reader@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/bigquery.jobUser"

# Create key
gcloud iam service-accounts keys create /tmp/gcp-billing-creds.json \
  --iam-account=gcp-billing-reader@$PROJECT_ID.iam.gserviceaccount.com

# Store in Secret Manager
gcloud secrets create gcp-credentials --data-file=/tmp/gcp-billing-creds.json

# Grant access
gcloud secrets add-iam-policy-binding gcp-credentials \
  --member="serviceAccount:$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# Create BigQuery dataset
bq mk --dataset --location=US $PROJECT_ID:billing_data

# Configure billing export
echo "Configure BigQuery export manually:"
echo "1. Go to: https://console.cloud.google.com/billing/$GCP_BILLING_ACCOUNT/export"
echo "2. Click 'EDIT SETTINGS' for 'Standard usage cost'"
echo "3. Set Project: $PROJECT_ID"
echo "4. Set Dataset: billing_data"
echo "5. Click 'SAVE'"
echo ""
echo "Note: Data will populate in 24-48 hours"
```

## Done! 🎉

Your Billing Manager is now running at:
- **Frontend**: https://$PROJECT_ID.web.app
- **Backend**: [URL from step 7]

### Next Steps

1. **Refresh the frontend** and view your AWS costs
2. **Set up budgets** in AWS/GCP consoles
3. **Wait 24-48 hours** for GCP BigQuery billing export data
4. **Create schedules** for automatic cost collection

## Quick Test

```bash
# Test backend health
curl "$BACKEND_URL/api/health"

# List services
curl "$BACKEND_URL/api/services" | jq

# Get costs
curl "$BACKEND_URL/api/costs?serviceId=aws" | jq
```

## Troubleshooting

### GitHub Actions Fails
- Check secrets are set correctly
- Verify service account has all permissions
- Check workflow logs: https://github.com/YOUR_USERNAME/billing-manager/actions

### Backend Not Responding
```bash
# Check logs
gcloud run services logs read billing-api --region=$REGION --limit=50

# Check service status
gcloud run services describe billing-api --region=$REGION
```

### No Costs Showing
```bash
# Verify credentials exist
gcloud secrets list

# Test cost collection manually
curl -X POST "$BACKEND_URL/api/costs/collect" \
  -H "Content-Type: application/json" \
  -d '{"serviceId": "aws"}'
```

## Cost Estimate

Running this application costs approximately:
- Cloud Run: £0.50-1.00/month (with minimal traffic)
- Firestore: £0.20-0.50/month
- Secret Manager: £0.10/month
- BigQuery: £0.10/month (small dataset)
- **Total**: ~£1-2/month

---

For detailed configuration and advanced features, see [DEPLOYMENT.md](./DEPLOYMENT.md)
