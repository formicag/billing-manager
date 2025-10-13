# Decommissioning Guide

Complete guide to safely remove all Billing Manager resources from GCP and stop all charges.

## ⚠️ WARNING

This process is **IRREVERSIBLE**. All data will be permanently deleted.

## Before You Start

### 1. Export All Data (IMPORTANT)

```bash
# Set your project ID
export PROJECT_ID="your-project-id"
gcloud config set project $PROJECT_ID

# Create backup directory
mkdir -p ~/billing-manager-backup/$(date +%Y%m%d)
cd ~/billing-manager-backup/$(date +%Y%m%d)
```

### 2. Export Firestore Data

```bash
# Create GCS bucket for export
gsutil mb -l europe-west2 gs://$PROJECT_ID-firestore-backup

# Export Firestore database
gcloud firestore export gs://$PROJECT_ID-firestore-backup/$(date +%Y%m%d)

# Download locally
gsutil -m cp -r gs://$PROJECT_ID-firestore-backup/$(date +%Y%m%d) ./firestore-data/

# Export as JSON (requires firestore-export tool or script)
echo "Manual export via Console: https://console.cloud.google.com/firestore/data"
```

### 3. Export Secrets

```bash
# List all secrets
gcloud secrets list --format="table(name)"

# Export each secret
mkdir -p secrets
for secret in $(gcloud secrets list --format="value(name)"); do
  echo "Exporting $secret..."
  gcloud secrets versions access latest --secret="$secret" > "secrets/${secret}.json"
done

echo "Secrets backed up to: $(pwd)/secrets/"
```

### 4. Export BigQuery Billing Data

```bash
# Create directory
mkdir -p bigquery-data

# Export billing data
bq extract \
  --destination_format=NEWLINE_DELIMITED_JSON \
  $PROJECT_ID:billing_data.gcp_billing_export_v1_* \
  gs://$PROJECT_ID-firestore-backup/bigquery/billing-*.json

# Download
gsutil -m cp -r gs://$PROJECT_ID-firestore-backup/bigquery/ ./bigquery-data/
```

### 5. Export Configuration

```bash
# Save GitHub Actions workflow
cp -r ~/path/to/billing-manager/.github ./github-workflows/

# Save environment configuration
echo "PROJECT_ID=$PROJECT_ID" > config.txt
gcloud run services describe billing-api --region=europe-west2 --format=yaml > cloud-run-config.yaml
firebase hosting:channel:list > firebase-config.txt

echo "Backup complete! Location: $(pwd)"
```

## Step-by-Step Decommissioning

### Step 1: Disable Schedules

```bash
# List all scheduler jobs
gcloud scheduler jobs list --location=europe-west2

# Pause all jobs
for job in $(gcloud scheduler jobs list --location=europe-west2 --format="value(name)"); do
  gcloud scheduler jobs pause $job --location=europe-west2 --quiet
  echo "Paused: $job"
done

# Wait 5 minutes to ensure no running jobs
echo "Waiting 5 minutes for jobs to complete..."
sleep 300
```

### Step 2: Delete Cloud Scheduler Jobs

```bash
# Delete all scheduler jobs
for job in $(gcloud scheduler jobs list --location=europe-west2 --format="value(name)"); do
  gcloud scheduler jobs delete $job --location=europe-west2 --quiet
  echo "Deleted job: $job"
done

# Verify
gcloud scheduler jobs list --location=europe-west2
```

### Step 3: Delete Cloud Run Services

```bash
# List services
gcloud run services list --region=europe-west2

# Delete backend API
gcloud run services delete billing-api --region=europe-west2 --quiet

# Delete any other Cloud Run services
for service in $(gcloud run services list --region=europe-west2 --format="value(metadata.name)"); do
  gcloud run services delete $service --region=europe-west2 --quiet
  echo "Deleted service: $service"
done

# Verify
gcloud run services list --region=europe-west2
```

### Step 4: Delete Firebase Hosting

```bash
# List hosting sites
firebase hosting:sites:list --project=$PROJECT_ID

# Disable hosting
firebase hosting:disable --project=$PROJECT_ID

# Note: This doesn't delete the site, just disables it
```

### Step 5: Delete Secrets

```bash
# List all secrets
gcloud secrets list

# Delete each secret
for secret in $(gcloud secrets list --format="value(name)"); do
  gcloud secrets delete $secret --quiet
  echo "Deleted secret: $secret"
done

# Verify
gcloud secrets list
```

### Step 6: Delete BigQuery Dataset

```bash
# List datasets
bq ls --project_id=$PROJECT_ID

# Delete billing dataset (and all tables)
bq rm -r -f -d $PROJECT_ID:billing_data

# Verify
bq ls --project_id=$PROJECT_ID
```

### Step 7: Delete Firestore Database

```bash
# WARNING: This deletes ALL Firestore data
gcloud firestore databases delete --database="(default)" --quiet

# Verify (should show no database)
gcloud firestore databases list
```

### Step 8: Delete Storage Buckets

```bash
# List all buckets
gsutil ls

# Delete project buckets
for bucket in $(gsutil ls | grep $PROJECT_ID); do
  echo "Deleting bucket: $bucket"
  gsutil -m rm -r $bucket
done

# Verify
gsutil ls
```

### Step 9: Delete Service Accounts

```bash
# List service accounts
gcloud iam service-accounts list

# Delete custom service accounts
for sa in github-actions gcp-billing-reader; do
  email="${sa}@${PROJECT_ID}.iam.gserviceaccount.com"
  gcloud iam service-accounts delete $email --quiet 2>/dev/null && echo "Deleted: $email" || echo "Not found: $email"
done

# Verify
gcloud iam service-accounts list --filter="email:*@$PROJECT_ID.iam.gserviceaccount.com"
```

### Step 10: Remove Billing Account Link (Optional)

```bash
# Unlink billing from project (this will make project inactive but keeps it)
gcloud billing projects unlink $PROJECT_ID

echo "Billing unlinked. Project will no longer incur charges."
```

### Step 11: Delete Entire Project (FINAL STEP)

```bash
# ⚠️ FINAL WARNING: This deletes EVERYTHING
echo "About to delete project: $PROJECT_ID"
echo "This is IRREVERSIBLE. Press Ctrl+C to cancel or Enter to continue..."
read

# Delete project
gcloud projects delete $PROJECT_ID --quiet

echo "Project $PROJECT_ID marked for deletion."
echo "It will be permanently deleted in 30 days."
echo "To recover before then: gcloud projects undelete $PROJECT_ID"
```

### Step 12: Clean Up Local Files

```bash
# Remove local service account keys
rm ~/gcp-key.json 2>/dev/null
rm ~/gcp-billing-credentials.json 2>/dev/null
rm /tmp/aws-creds.json 2>/dev/null
rm /tmp/gcp-billing-creds.json 2>/dev/null

# Remove Firebase cache
rm -rf ~/.config/firebase

# Remove gcloud credentials (optional)
# gcloud auth revoke
```

### Step 13: Remove GitHub Repository (Optional)

```bash
# Using GitHub CLI
gh repo delete YOUR_USERNAME/billing-manager --yes

# Or manually:
# 1. Go to: https://github.com/YOUR_USERNAME/billing-manager/settings
# 2. Scroll to "Danger Zone"
# 3. Click "Delete this repository"
```

## Verification Checklist

Run these commands to verify everything is deleted:

```bash
# Set project (may fail if deleted)
gcloud config set project $PROJECT_ID

# Check Cloud Run (should be empty)
gcloud run services list --region=europe-west2

# Check Scheduler (should be empty)
gcloud scheduler jobs list --location=europe-west2

# Check Secrets (should be empty)
gcloud secrets list

# Check Firestore (should be empty or not exist)
gcloud firestore databases list

# Check BigQuery (should be empty)
bq ls --project_id=$PROJECT_ID

# Check Storage (should be empty)
gsutil ls

# Check project status
gcloud projects describe $PROJECT_ID
```

## Cost Verification

After decommissioning, verify no charges:

1. **Go to GCP Billing Console**:
   https://console.cloud.google.com/billing

2. **Check for charges**:
   - View last 7 days
   - Should see declining charges
   - After 24-48 hours, charges should be $0

3. **Set up billing alert** (if keeping GCP account):
   ```bash
   gcloud billing budgets create \
     --billing-account=YOUR_BILLING_ACCOUNT \
     --display-name="Zero Budget Alert" \
     --budget-amount=1 \
     --threshold-rule=threshold-percent=0.5
   ```

## Partial Decommissioning

If you only want to stop charges but keep data:

### Option 1: Pause Cloud Run

```bash
# Scale to zero (stops charges when idle)
gcloud run services update billing-api \
  --region=europe-west2 \
  --min-instances=0 \
  --max-instances=0

# To resume later:
# gcloud run services update billing-api --region=europe-west2 --max-instances=10
```

### Option 2: Disable Schedulers Only

```bash
# Pause all schedulers (stops automatic collection)
for job in $(gcloud scheduler jobs list --location=europe-west2 --format="value(name)"); do
  gcloud scheduler jobs pause $job --location=europe-west2
done

# Costs: ~£0.20/month for Firestore + Secret Manager
```

### Option 3: Keep Data, Delete Services

```bash
# Delete Cloud Run (but keep Firestore + Secrets)
gcloud run services delete billing-api --region=europe-west2

# Delete Schedulers
gcloud scheduler jobs delete collect-costs-daily --location=europe-west2

# Costs: ~£0.30/month for Firestore + Secret Manager storage
```

## Recovery

If you deleted by mistake and it's within 30 days:

```bash
# Undelete project
gcloud projects undelete $PROJECT_ID

# Re-link billing
gcloud billing projects link $PROJECT_ID \
  --billing-account=YOUR_BILLING_ACCOUNT

# Restore Firestore data
gcloud firestore import gs://$PROJECT_ID-firestore-backup/BACKUP_DATE

# Restore secrets
for secret_file in ~/billing-manager-backup/DATE/secrets/*.json; do
  secret_name=$(basename $secret_file .json)
  gcloud secrets create $secret_name --data-file="$secret_file"
done

# Redeploy services
cd billing-manager
git push origin main  # Triggers GitHub Actions deployment
```

## Common Issues

### "Permission Denied" Errors

```bash
# Grant yourself owner role
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="user:YOUR_EMAIL@gmail.com" \
  --role="roles/owner"
```

### Firestore Won't Delete

```bash
# Try via Console
open "https://console.cloud.google.com/firestore/databases?project=$PROJECT_ID"

# Or use Firebase CLI
firebase firestore:delete --all-collections --project=$PROJECT_ID
```

### Bucket Won't Delete (Objects Remain)

```bash
# Force delete all objects
gsutil -m rm -r gs://BUCKET_NAME/**

# Then delete bucket
gsutil rb gs://BUCKET_NAME
```

### Project Won't Delete (Lien)

```bash
# Check for liens
gcloud alpha resource-manager liens list --project=$PROJECT_ID

# Remove liens (if any)
gcloud alpha resource-manager liens delete LIEN_NAME
```

## Post-Decommissioning

1. **Remove from bookmarks/shortcuts**
2. **Delete local project folder** (after confirming backup)
3. **Update documentation** if this was production
4. **Notify team members** if shared project

## Support

If you need help:
- Check GCP quotas: https://console.cloud.google.com/iam-admin/quotas
- Contact GCP support: https://cloud.google.com/support
- Check billing: https://console.cloud.google.com/billing

---

**Document Version**: 1.0
**Last Updated**: 2025-10-13
