# Quick Start Guide

Get your Billing Manager running in 5 minutes!

## Prerequisites

- Node.js 18+
- Git
- GitHub account
- GCP account (for deployment)

## Step 1: Push to GitHub

```bash
# Create a new repository on GitHub
# Then run:

cd /Users/gianlucaformica/Projects/billing-manager
git remote add origin https://github.com/YOUR-USERNAME/billing-manager.git
git push -u origin main
```

## Step 2: Local Development (Optional)

### Backend

```bash
cd backend
npm install

# Create .env file
cp .env.example .env

# Edit .env:
# PROJECT_ID=your-test-project
# PORT=8080

# Start server
npm run dev
```

Backend runs at: http://localhost:8080

### Frontend

```bash
cd frontend
npm install

# Create .env file
cp .env.example .env

# Edit .env:
# REACT_APP_API_URL=http://localhost:8080

# Start app
npm start
```

Frontend runs at: http://localhost:3000

## Step 3: Deploy to GCP

Follow the detailed guide in [DEPLOYMENT.md](./DEPLOYMENT.md)

Quick version:

```bash
# 1. Create GCP project
export PROJECT_ID="billing-manager-yourname"
gcloud projects create $PROJECT_ID
gcloud config set project $PROJECT_ID

# 2. Enable APIs
gcloud services enable run.googleapis.com firestore.googleapis.com \
  secretmanager.googleapis.com cloudscheduler.googleapis.com \
  cloudbuild.googleapis.com firebase.googleapis.com

# 3. Create Firestore
gcloud firestore databases create --location=europe-west2

# 4. Create service account and get key
gcloud iam service-accounts create github-actions
# ... (see DEPLOYMENT.md for full commands)

# 5. Add GitHub secrets:
# - GCP_SA_KEY
# - GCP_PROJECT
# - FIREBASE_SA_KEY

# 6. Push to GitHub (triggers auto-deploy)
git push origin main
```

## Step 4: Access Your App

After deployment completes:

```bash
# Get URLs
gcloud run services describe billing-api --region=europe-west2 --format='value(status.url)'
firebase hosting:channel:list
```

Visit your app at: `https://YOUR-PROJECT.web.app`

## Step 5: Configure Services

1. **Add Credentials**
   - Navigate to "Credentials" in the app
   - Click "Add Credential"
   - Select service (AWS, GCP, etc.)
   - Enter credentials
   - Test and save

2. **Set Schedules**
   - Go to "Schedules"
   - Toggle on for each service
   - Select frequency (daily recommended)
   - Save

3. **Trigger First Collection**
   - Dashboard → "Refresh All"
   - Or click refresh on individual service

4. **View Costs**
   - Dashboard shows summary
   - Click service card for details
   - Use date picker for date range
   - Filter by tags if needed

## Supported Services

- **AWS**: Access Key ID, Secret Access Key
- **GCP**: Service Account JSON
- **Atlassian**: API Token + Email
- **Google Workspace**: Admin credentials
- **ChatGPT**: API Key
- **Cohere**: API Key

## Dark Mode

The entire app is in dark mode by default! The theme is configured in:
- `frontend/src/App.jsx` - Main theme configuration
- `frontend/src/index.css` - Global styles

## Troubleshooting

### Backend won't start
```bash
cd backend
rm -rf node_modules package-lock.json
npm install
npm run dev
```

### Frontend won't start
```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
npm start
```

### Build fails
Check Node.js version:
```bash
node --version  # Should be 18+
```

### Can't connect to API
1. Check backend is running
2. Verify `.env` file exists in frontend
3. Check REACT_APP_API_URL matches backend URL

## Development Tips

### Hot Reload
- Frontend: Changes auto-reload
- Backend: Using nodemon for auto-restart

### Debugging
```bash
# Backend logs
cd backend
npm run dev

# Frontend logs
cd frontend
npm start
# Check browser console
```

### Testing APIs
```bash
# Health check
curl http://localhost:8080/api/health

# Get services
curl http://localhost:8080/api/services

# Get costs
curl http://localhost:8080/api/costs
```

## Project Structure

```
billing-manager/
├── backend/              # Express API
│   ├── routes/          # API endpoints
│   │   ├── costs.js
│   │   ├── credentials.js
│   │   ├── schedules.js
│   │   ├── services.js
│   │   ├── backfill.js
│   │   └── health.js
│   ├── server.js        # Main server
│   ├── package.json
│   └── Dockerfile
│
├── frontend/            # React PWA
│   ├── src/
│   │   ├── components/  # UI components
│   │   │   ├── Dashboard.jsx
│   │   │   ├── ServiceDetail.jsx
│   │   │   ├── CredentialManager.jsx
│   │   │   ├── ScheduleManager.jsx
│   │   │   ├── BackfillManager.jsx
│   │   │   └── Settings.jsx
│   │   ├── services/
│   │   │   └── api.js   # API client
│   │   ├── App.jsx      # Dark theme
│   │   └── index.js
│   ├── public/
│   │   ├── index.html
│   │   └── manifest.json
│   └── package.json
│
├── .github/workflows/   # CI/CD
│   └── deploy.yml
│
├── README.md            # Main docs
├── DEPLOYMENT.md        # Deploy guide
└── QUICKSTART.md        # This file
```

## Next Steps

1. **Add more services**: Edit `backend/routes/services.js`
2. **Customize theme**: Edit `frontend/src/App.jsx`
3. **Add features**: Create new components
4. **Set up alerts**: Configure Cloud Monitoring
5. **Add analytics**: Integrate Google Analytics

## Cost Estimate

- Cloud Run: ~£0.50/month
- Firestore: ~£0.30/month
- Secret Manager: ~£0.10/month
- Firebase Hosting: Free
- **Total: £1-2/month**

## Support

- Check [README.md](./README.md) for features
- See [DEPLOYMENT.md](./DEPLOYMENT.md) for deployment
- Open issue on GitHub for bugs

---

Happy cost tracking! 🎉
