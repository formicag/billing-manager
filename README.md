# Billing Manager

Multi-cloud cost tracking and billing management application with dark mode UI.

## Features

- **Multi-Service Support**: Track costs across AWS, GCP, Atlassian, Google Workspace, ChatGPT, and Cohere
- **Budget & Alerts Display**: View configured budgets, alert thresholds, and notification channels for AWS and GCP
- **Dashboard**: Real-time overview of all services and costs
- **Cost Analytics**: Detailed cost breakdowns with charts and resource-level insights
- **AWS Cost Explorer Integration**: Real-time AWS cost collection with service-level breakdown
- **GCP BigQuery Integration**: Query GCP billing export for detailed cost analysis
- **Credential Management**: Secure storage using GCP Secret Manager
- **Automated Collection**: Scheduled cost collection with Cloud Scheduler
- **Historical Backfill**: Import past cost data
- **Tag-Based Filtering**: Filter and group resources by tags
- **Progressive Web App**: Install on any device, works offline
- **Dark Mode**: Beautiful dark theme throughout
- **Responsive**: Works on desktop, tablet, and mobile

## Architecture

```
billing-manager/
├── backend/                # Express.js API
│   ├── routes/            # API endpoints
│   ├── server.js          # Main server
│   └── Dockerfile         # Container config
├── frontend/              # React PWA
│   ├── src/
│   │   ├── components/    # UI components
│   │   ├── services/      # API client
│   │   └── App.jsx        # Main app with dark theme
│   └── public/            # Static assets
└── .github/workflows/     # CI/CD pipeline
```

## Tech Stack

### Backend
- Node.js 18 + Express
- Google Cloud Firestore (database)
- Google Cloud Secret Manager (credentials)
- Cloud Run (hosting)
- Cloud Scheduler (automation)

### Frontend
- React 18
- Material-UI (MUI) with dark theme
- React Router
- Recharts (charts)
- Axios (API)
- Workbox (PWA)
- Firebase Hosting

## Quick Start

**New to the project?** Check out [QUICK-DEPLOY.md](./QUICK-DEPLOY.md) for a 15-minute deployment guide.

### Prerequisites

- Node.js 18+
- GCP account with billing enabled
- GitHub account
- Firebase CLI: `npm install -g firebase-tools`
- Google Cloud SDK

### Local Development

1. **Clone repository**
```bash
git clone https://github.com/[your-username]/billing-manager.git
cd billing-manager
```

2. **Backend setup**
```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your GCP project ID
npm run dev
```

3. **Frontend setup**
```bash
cd frontend
npm install
cp .env.example .env
# Edit .env with backend URL (http://localhost:8080)
npm start
```

4. **Access application**
- Frontend: http://localhost:3000
- Backend API: http://localhost:8080

### Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions.

## Configuration

### Environment Variables

**Backend (.env)**
```env
PROJECT_ID=your-gcp-project-id
PORT=8080
NODE_ENV=production
FRONTEND_URL=https://your-app.web.app
```

**Frontend (.env)**
```env
REACT_APP_API_URL=https://your-backend-url.run.app
```

### GitHub Secrets

Required secrets for CI/CD:
- `GCP_SA_KEY`: Service account JSON key
- `GCP_PROJECT`: GCP project ID
- `FIREBASE_SA_KEY`: Firebase service account key

## Usage

### 1. Configure Credentials

Navigate to **Credentials** and add API credentials for each service:

- **AWS**: Access Key ID, Secret Access Key, Region
- **GCP**: Service Account JSON
- **Atlassian**: API Token, Email
- **Google Workspace**: Admin credentials
- **ChatGPT**: API Key
- **Cohere**: API Key

### 2. Set Collection Schedules

Go to **Schedules** and configure how often to collect costs:

- Hourly (every hour)
- Daily (9 AM)
- Weekly (Monday 9 AM)

### 3. View Costs

Dashboard shows:
- Total costs across all services
- Cost per service
- Last collection timestamp
- Predicted monthly costs

Click on a service for detailed breakdown.

### 4. Import Historical Data

Use **Backfill** to import past cost data:
- Select service
- Choose date range
- Monitor progress

## API Endpoints

### Services
- `GET /api/services` - List all services
- `GET /api/services/:id` - Get service details
- `PUT /api/services/:id` - Update service config

### Costs
- `GET /api/costs` - Get cost data
- `GET /api/costs/summary` - Cost summary by service
- `GET /api/costs/:serviceId/resources` - Resource-level costs
- `POST /api/costs/collect` - Trigger collection (supports AWS & GCP)

### Budgets
- `GET /api/budgets` - Get all budgets across services
- `GET /api/budgets/:serviceId` - Get budgets for specific service

### Credentials
- `GET /api/credentials` - List configured credentials
- `POST /api/credentials/:serviceId` - Save credentials
- `POST /api/credentials/:serviceId/reveal` - View credentials
- `DELETE /api/credentials/:serviceId` - Delete credentials

### Schedules
- `GET /api/schedules` - List all schedules
- `PUT /api/schedules/:serviceId` - Update schedule
- `POST /api/schedules/:serviceId/run` - Run now

### Backfill
- `POST /api/backfill` - Create backfill job
- `GET /api/backfill/jobs` - List jobs
- `GET /api/backfill/jobs/:jobId` - Job status

## Cost Estimate

Running on GCP with minimal usage:

- Cloud Run (backend): ~£0.50/month
- Firestore: ~£0.30/month
- Secret Manager: ~£0.10/month
- Firebase Hosting: Free tier
- **Total**: ~£1-2/month

## Security

- Credentials stored in GCP Secret Manager
- HTTPS everywhere
- No credential logging
- Service account with minimal permissions
- Secret access audited

## PWA Installation

**Desktop:**
1. Open app in Chrome/Edge
2. Click install icon in address bar

**Mobile (iOS):**
1. Open in Safari
2. Tap Share → Add to Home Screen

**Mobile (Android):**
1. Open in Chrome
2. Menu → Add to Home Screen

## Development

### Project Structure

```
frontend/src/
├── components/
│   ├── Dashboard.jsx          # Main dashboard
│   ├── ServiceDetail.jsx      # Service costs
│   ├── CredentialManager.jsx  # Credentials
│   ├── ScheduleManager.jsx    # Schedules
│   ├── BackfillManager.jsx    # Historical import
│   └── Settings.jsx           # App settings
├── services/
│   └── api.js                 # API client
├── App.jsx                    # Dark theme config
└── index.js                   # Entry point
```

### Adding a New Service

1. Update `SUPPORTED_SERVICES` in `backend/routes/services.js`
2. Add service icon in `frontend/src/components/CredentialManager.jsx`
3. Implement cost collector service
4. Update API endpoints

## Troubleshooting

### API Connection Failed
- Check backend is running
- Verify `REACT_APP_API_URL` in frontend/.env
- Check CORS settings

### Credentials Not Saving
- Verify Secret Manager API is enabled
- Check service account permissions
- Review backend logs

### Costs Not Collecting
- Ensure credentials are configured
- Check schedule is enabled
- Verify service API access

## Decommissioning

**Removing the application?** See [DECOMMISSION.md](./DECOMMISSION.md) for complete step-by-step removal guide with data backup instructions.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For issues or questions:
- Open an issue on GitHub
- Check deployment documentation
- Review GCP logs

## Roadmap

- [x] Budget alerts and notifications display
- [x] AWS Cost Explorer integration
- [x] GCP BigQuery billing export integration
- [ ] Cost optimization recommendations
- [ ] Email/Slack notifications for budget thresholds
- [ ] Multi-user support with authentication
- [ ] Custom dashboards
- [ ] Export to CSV/PDF
- [ ] Integration with more services (Azure, Oracle Cloud)
- [ ] Cost forecasting with ML
- [ ] Mobile apps (iOS/Android)
- [ ] Cost anomaly detection

---

Built with Node.js, React, Material-UI, and Google Cloud Platform
