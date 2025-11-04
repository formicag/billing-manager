# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.3.1] - 2025-10-14

### Added
- **Automatic Deduplication**: Cost records now use composite unique IDs (serviceId + date) to prevent duplicates
- **Migration Script**: Added `scripts/deduplicate-costs.js` to clean up existing duplicates and migrate to new ID format

### Changed
- Cost collection now updates existing records instead of creating duplicates when run multiple times
- Each cost record uses predictable document ID: `{serviceId}_{YYYY-MM-DD}`
- Added `createdAt` and `updatedAt` timestamps to all cost records
- API response now includes `newRecords` and `updatedRecords` count

### Fixed
- **Critical**: Fixed duplicate cost records when collection runs multiple times
- Prevented data accuracy issues caused by duplicate entries
- AWS costs now match AWS Console exactly (was showing 2x due to duplicates)

## [1.3.0] - 2025-10-14

### Added
- **Health Status Indicators**: Visual green/red/gray indicators on service cards showing collection success/failure status
  - Green "Healthy" chip for successful cost collections
  - Red "Failed" chip for failed collections with error details
  - Gray "Unknown" chip when no collection status is available
  - Tooltip on hover showing detailed status information (timestamp, costs collected, errors, warnings)
- **Collection Status API**: New `/api/costs/status/all` endpoint to retrieve collection health status for all services
- **Status Tracking**: Automatic recording of collection success/failure in Firestore `collection_status` collection
- **API Documentation**: Comprehensive API documentation in `API.md` file

### Changed
- Updated Dashboard component to fetch and display collection statuses
- Enhanced cost collection endpoint to track and store status information
- Improved error visibility with inline status indicators

### Documentation
- Updated README.md with health status indicators feature
- Updated QUICKSTART.md with health indicator usage
- Created comprehensive API.md documentation
- Added CHANGELOG.md for version tracking

## [1.2.0] - 2025-10-13

### Added
- **GCP BigQuery Integration**: Real-time cost collection from GCP billing export
- **Data Quality Verification**: Removed all fake/estimated data, verified 100% real data from APIs
- **Duplicate Data Cleanup**: Removed 94 duplicate cost records across all services

### Changed
- Updated Cohere collector to show accurate $0 instead of estimated data
- Updated ChatGPT collector to show real usage from OpenAI API
- Fixed GCP collector to query BigQuery billing export table

### Fixed
- Removed 80 duplicate AWS cost records
- Removed 14 old GCP error records
- Fixed multiple cost records for same date/service

## [1.1.0] - 2025-10-12

### Added
- **Budget & Alerts Display**: View configured budgets, alert thresholds, and notification channels for AWS and GCP
- **AWS Cost Explorer Integration**: Real-time AWS cost collection with service-level breakdown
- **Tag-Based Filtering**: Filter and group resources by tags

### Changed
- Improved service detail pages with budget information
- Enhanced cost analytics with resource-level insights

## [1.0.0] - 2025-10-10

### Added
- Initial release of Billing Manager
- **Multi-Service Support**: AWS, GCP, Atlassian, Google Workspace, ChatGPT, and Cohere
- **Dashboard**: Real-time overview of all services and costs
- **Cost Analytics**: Detailed cost breakdowns with charts
- **Credential Management**: Secure storage using GCP Secret Manager
- **Automated Collection**: Scheduled cost collection with Cloud Scheduler
- **Historical Backfill**: Import past cost data
- **Progressive Web App**: Install on any device, works offline
- **Dark Mode**: Beautiful dark theme throughout
- **Responsive Design**: Works on desktop, tablet, and mobile
- **CI/CD Pipeline**: GitHub Actions for automated deployment
- **Backend**: Node.js + Express + Firestore + Cloud Run
- **Frontend**: React 18 + Material-UI + Firebase Hosting

### Security
- Credentials stored in GCP Secret Manager
- HTTPS everywhere
- Service account with minimal permissions
- Secret access auditing

---

## Version History

- **1.3.0** (2025-10-14): Health status indicators and collection monitoring
- **1.2.0** (2025-10-13): GCP BigQuery integration and data quality improvements
- **1.1.0** (2025-10-12): Budget alerts and AWS Cost Explorer integration
- **1.0.0** (2025-10-10): Initial release with multi-cloud support

---

## Upgrade Guide

### From 1.2.0 to 1.3.0

No breaking changes. Health status indicators will automatically appear after deployment.

**What to expect:**
1. Service cards will show gray "Unknown" chips initially
2. Run "Refresh All" to populate statuses
3. Health indicators will turn green as collections succeed
4. If a collection fails, you'll see a red "Failed" chip with error details

**New Firestore Collection:**
- `collection_status` - Stores collection success/failure status per service

### From 1.1.0 to 1.2.0

No breaking changes. Existing data will be preserved.

**Data Cleanup:**
- Removed duplicate cost records automatically
- Updated collectors to use real APIs only
- No manual intervention required

### From 1.0.0 to 1.1.0

No breaking changes. Budgets are read-only from cloud providers.

**New Features:**
- Budget information automatically displayed when available
- AWS Cost Explorer integration enabled by default
- Tag-based filtering works with existing cost data
