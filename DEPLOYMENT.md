# Deployment Guide

Complete guide for deploying Billing Manager to Google Cloud Platform.

## Prerequisites

### Required Accounts
- Google Cloud Platform account with billing enabled
- GitHub account
- Domain name (optional)

### Local Tools
```bash
# Install Node.js 18+
# Install Git
# Install Google Cloud SDK
curl https://sdk.cloud.google.com | bash

# Install Firebase CLI
npm install -g firebase-tools

# Login to GCP
gcloud auth login
```

## Step 1: Create GCP Project

```bash
# Set project ID
export PROJECT_ID="billing-manager-$(whoami)"

# Create project
gcloud projects create $PROJECT_ID --name="Billing Manager"

# Set as active project
gcloud config set project $PROJECT_ID

# Link billing account (required)
# Visit: https://console.cloud.google.com/billing
# Link your billing account to the project
```

## Step 2: Enable Required APIs

```bash
gcloud services enable run.googleapis.com
gcloud services enable firestore.googleapis.com
gcloud services enable secretmanager.googleapis.com
gcloud services enable cloudscheduler.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable firebase.googleapis.com
gcloud services enable bigquery.googleapis.com
gcloud services enable bigquerydatatransfer.googleapis.com
gcloud services enable cloudbilling.googleapis.com
gcloud services enable billingbudgets.googleapis.com
```

## Step 3: Initialize Firestore

```bash
# Create Firestore database in Native mode
gcloud firestore databases create --location=europe-west2

# Verify
gcloud firestore databases list
```

## Step 4: Initialize Firebase

```bash
cd billing-manager

# Login to Firebase
firebase login

# Initialize Firebase
firebase init

# Select:
# - Hosting
# - Use existing project: [your-project-id]
# - Public directory: frontend/build
# - Single-page app: Yes
# - GitHub setup: No (we use GitHub Actions)

# Create firebase.json if not exists
```

## Step 5: Create Service Account

```bash
# Create service account for CI/CD
gcloud iam service-accounts create github-actions \
  --display-name="GitHub Actions Service Account"

# Grant necessary roles
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/cloudbuild.builds.builder"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/firebase.admin"

# Create key
gcloud iam service-accounts keys create ~/gcp-key.json \
  --iam-account=github-actions@$PROJECT_ID.iam.gserviceaccount.com

# Display key (copy for next step)
cat ~/gcp-key.json
```

## Step 6: Configure GitHub Repository

### Create Repository

1. Go to https://github.com/new
2. Create repository named `billing-manager`
3. Don't initialize with README (we have one)

### Add GitHub Secrets

Go to: Settings > Secrets and variables > Actions > New repository secret

Add these secrets:

**GCP_SA_KEY**
```
[Paste entire content of ~/gcp-key.json]
```

**GCP_PROJECT**
```
[your-project-id]
```

**FIREBASE_SA_KEY**
```
[Same as GCP_SA_KEY]
```

## Step 7: Push Code to GitHub

```bash
cd billing-manager

# Initialize git
git init
git add .
git commit -m "Initial commit: Billing Manager with dark mode"

# Add remote
git remote add origin https://github.com/[your-username]/billing-manager.git

# Push
git branch -M main
git push -u origin main
```

This triggers automatic deployment via GitHub Actions.

## Step 8: Monitor Deployment

```bash
# Watch GitHub Actions
# Go to: https://github.com/[your-username]/billing-manager/actions

# Or check logs
gcloud run services logs read billing-api --region=europe-west2
```

## Step 9: Get Application URLs

```bash
# Backend URL
gcloud run services describe billing-api \
  --region=europe-west2 \
  --format='value(status.url)'

# Frontend URL
firebase hosting:channel:list
# Or visit: https://[project-id].web.app
```

## Step 10: Configure Cloud Scheduler

```bash
# Get backend URL
export BACKEND_URL=$(gcloud run services describe billing-api \
  --region=europe-west2 --format='value(status.url)')

# Create daily job (9 AM)
gcloud scheduler jobs create http collect-costs-daily \
  --location=europe-west2 \
  --schedule="0 9 * * *" \
  --uri="$BACKEND_URL/api/costs/collect" \
  --http-method=POST \
  --oidc-service-account-email=github-actions@$PROJECT_ID.iam.gserviceaccount.com

# Test job
gcloud scheduler jobs run collect-costs-daily --location=europe-west2
```

## Step 11: Configure GCP BigQuery Billing Export (Optional)

For GCP cost tracking with real data:

```bash
# Get billing account ID
gcloud billing accounts list

export BILLING_ACCOUNT_ID="YOUR-BILLING-ACCOUNT-ID"

# Create service account for billing
gcloud iam service-accounts create gcp-billing-reader \
  --display-name="GCP Billing Reader"

# Grant billing viewer permissions
gcloud billing accounts add-iam-policy-binding $BILLING_ACCOUNT_ID \
  --member="serviceAccount:gcp-billing-reader@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/billing.viewer"

# Grant BigQuery permissions
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:gcp-billing-reader@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/bigquery.dataViewer"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:gcp-billing-reader@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/bigquery.jobUser"

# Create BigQuery dataset
bq mk --dataset --location=US $PROJECT_ID:billing_data

# Create and store credentials
gcloud iam service-accounts keys create ~/gcp-billing-key.json \
  --iam-account=gcp-billing-reader@$PROJECT_ID.iam.gserviceaccount.com

# Store in Secret Manager
gcloud secrets create gcp-credentials --data-file=~/gcp-billing-key.json

# Grant Cloud Run access to secret
gcloud secrets add-iam-policy-binding gcp-credentials \
  --member="serviceAccount:$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

**Configure BigQuery Export** (must be done via Console):
1. Go to: https://console.cloud.google.com/billing/[billing-account-id]/export
2. Click "EDIT SETTINGS" for "Standard usage cost"
3. Set Project: [your-project-id]
4. Set Dataset: billing_data
5. Click "SAVE"

**Note**: Data will populate in 24-48 hours

## Step 12: Configure AWS Cost Collection (Optional)

For AWS cost tracking:

```bash
# Assuming you have AWS credentials
# Create JSON file with AWS credentials
cat > /tmp/aws-creds.json << EOF
{
  "accessKeyId": "YOUR_AWS_ACCESS_KEY",
  "secretAccessKey": "YOUR_AWS_SECRET_KEY",
  "region": "us-east-1"
}
EOF

# Store in Secret Manager
gcloud secrets create aws-credentials --data-file=/tmp/aws-creds.json

# Grant access
gcloud secrets add-iam-policy-binding aws-credentials \
  --member="serviceAccount:$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# Clean up
rm /tmp/aws-creds.json
```

## Step 13: Test Application

1. **Access frontend**: https://[project-id].web.app
2. **Test backend**:
```bash
curl https://[backend-url]/api/health
```
3. **Trigger cost collection**:
```bash
# For AWS
curl -X POST https://[backend-url]/api/costs/collect \
  -H "Content-Type: application/json" \
  -d '{"serviceId": "aws"}'

# For GCP
curl -X POST https://[backend-url]/api/costs/collect \
  -H "Content-Type: application/json" \
  -d '{"serviceId": "gcp"}'
```
4. **View budgets**:
```bash
curl https://[backend-url]/api/budgets/aws
curl https://[backend-url]/api/budgets/gcp
```

## Local Development Setup

### With Emulators

```bash
# Start Firestore emulator
firebase emulators:start --only firestore

# In new terminal - Backend
cd backend
cp .env.example .env
# Edit .env:
# PROJECT_ID=your-project-id
# FIRESTORE_EMULATOR_HOST=localhost:8080
npm install
npm run dev

# In new terminal - Frontend
cd frontend
cp .env.example .env
# Edit .env:
# REACT_APP_API_URL=http://localhost:8080
npm install
npm start
```

Access at http://localhost:3000

## Custom Domain

### Option 1: Firebase Hosting

```bash
# Add custom domain
firebase hosting:site:create [your-domain]

# Follow instructions to verify domain
# Update DNS records
```

### Option 2: Cloud Run + Load Balancer

```bash
# Map custom domain to Cloud Run
gcloud run domain-mappings create \
  --service=billing-api \
  --region=europe-west2 \
  --domain=api.yourdomain.com
```

## Monitoring

### View Logs

```bash
# Backend logs
gcloud run services logs read billing-api \
  --region=europe-west2 \
  --limit=50

# Follow logs
gcloud run services logs tail billing-api \
  --region=europe-west2
```

### Cloud Console

- Cloud Run: https://console.cloud.google.com/run
- Firestore: https://console.cloud.google.com/firestore
- Secret Manager: https://console.cloud.google.com/security/secret-manager
- Scheduler: https://console.cloud.google.com/cloudscheduler

## Troubleshooting

### Deployment Fails

```bash
# Check GitHub Actions logs
# Go to: https://github.com/[username]/billing-manager/actions

# Check Cloud Build
gcloud builds list --limit=5

# Check permissions
gcloud projects get-iam-policy $PROJECT_ID
```

### Backend Not Responding

```bash
# Check service status
gcloud run services describe billing-api --region=europe-west2

# Check logs
gcloud run services logs read billing-api --region=europe-west2 --limit=100

# Test health endpoint
curl https://[backend-url]/api/health
```

### Frontend Build Fails

```bash
# Check Node version
node --version  # Should be 18+

# Clear cache
cd frontend
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Firestore Permission Denied

```bash
# Check Firestore rules
gcloud firestore rules list

# Update rules to allow (development only)
# Visit: https://console.firebase.google.com/project/[project-id]/firestore/rules
```

## Cost Optimization

### Cloud Run
```bash
# Set minimum instances to 0
gcloud run services update billing-api \
  --region=europe-west2 \
  --min-instances=0 \
  --max-instances=10

# Reduce memory
gcloud run services update billing-api \
  --region=europe-west2 \
  --memory=256Mi
```

### Firestore
- Use composite indexes only when needed
- Set TTL on temporary documents
- Clean up old cost data periodically

### Secret Manager
- Delete old secret versions
- Use minimal access policies

## Backup and Restore

### Export Firestore Data

```bash
# Create bucket for backups
gsutil mb -l europe-west2 gs://$PROJECT_ID-backups

# Export Firestore
gcloud firestore export gs://$PROJECT_ID-backups/$(date +%Y%m%d)

# Download locally
gsutil -m cp -r gs://$PROJECT_ID-backups/$(date +%Y%m%d) ./backups/
```

### Export Secrets

```bash
# Export all credentials
for secret in $(gcloud secrets list --format="value(name)"); do
  gcloud secrets versions access latest --secret="$secret" > "./backups/${secret}.json"
done
```

### Restore Data

```bash
# Import Firestore
gcloud firestore import gs://$PROJECT_ID-backups/[backup-date]

# Restore secrets
gcloud secrets create [secret-name] --data-file="./backups/[secret-name].json"
```

## Decommissioning

### Export Data First

```bash
# Export everything
./scripts/export-all-data.sh
```

### Delete Resources

```bash
# Delete Cloud Run services
gcloud run services delete billing-api --region=europe-west2 --quiet

# Delete Scheduler jobs
gcloud scheduler jobs delete collect-costs-daily --location=europe-west2 --quiet

# Delete secrets
for secret in $(gcloud secrets list --format="value(name)"); do
  gcloud secrets delete $secret --quiet
done

# Delete Firestore
gcloud firestore databases delete --database="(default)" --quiet

# Delete service account
gcloud iam service-accounts delete \
  github-actions@$PROJECT_ID.iam.gserviceaccount.com --quiet

# Delete Firebase Hosting
firebase hosting:disable

# Delete entire project (CAREFUL!)
gcloud projects delete $PROJECT_ID
```

### Verify Deletion

```bash
# Check project status
gcloud projects describe $PROJECT_ID

# Verify no charges
# Visit: https://console.cloud.google.com/billing
```

## Security Best Practices

1. **Never commit credentials**
   - Add .env to .gitignore
   - Use Secret Manager

2. **Minimal permissions**
   - Service accounts with least privilege
   - Regular permission audits

3. **Enable audit logging**
```bash
gcloud logging read "resource.type=cloud_run_revision" --limit=50
```

4. **Use VPC for backend** (optional, increases cost)
```bash
gcloud run services update billing-api \
  --vpc-connector=[connector-name] \
  --vpc-egress=private-ranges-only
```

5. **Enable Cloud Armor** (optional)
   - DDoS protection
   - WAF rules

## Updates and Maintenance

### Update Backend

```bash
# Make changes to backend code
git add backend/
git commit -m "Update: [description]"
git push origin main

# GitHub Actions automatically deploys
```

### Update Frontend

```bash
# Make changes to frontend code
git add frontend/
git commit -m "Update: [description]"
git push origin main

# GitHub Actions automatically builds and deploys
```

### Manual Deployment

```bash
# Backend
cd backend
gcloud run deploy billing-api \
  --source . \
  --region=europe-west2 \
  --allow-unauthenticated

# Frontend
cd frontend
npm run build
firebase deploy --only hosting
```

## Support Resources

- [GCP Documentation](https://cloud.google.com/docs)
- [Firebase Documentation](https://firebase.google.com/docs)
- [Cloud Run Docs](https://cloud.google.com/run/docs)
- [Firestore Docs](https://cloud.google.com/firestore/docs)
- [GitHub Actions](https://docs.github.com/actions)

---

For issues or questions, open an issue on GitHub.
