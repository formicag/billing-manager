# Billing Manager API Documentation

Base URL: `https://billing-api-27056999013.europe-west2.run.app`

## Table of Contents

- [Health Check](#health-check)
- [Services](#services)
- [Costs](#costs)
- [Collection Status](#collection-status)
- [Credentials](#credentials)
- [Schedules](#schedules)
- [Backfill](#backfill)
- [Budgets](#budgets)

---

## Health Check

### GET /api/health

Check if the API is running.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-10-14T18:00:00.000Z"
}
```

---

## Services

### GET /api/services

Get list of all supported services.

**Response:**
```json
{
  "services": [
    {
      "id": "aws",
      "name": "Amazon Web Services",
      "enabled": true,
      "currentCost": 2.20,
      "lastUpdated": "2025-10-14T00:00:00.000Z"
    }
  ]
}
```

### GET /api/services/:serviceId

Get details for a specific service.

**Parameters:**
- `serviceId` (path): Service identifier (aws, gcp, google-workspace, atlassian, chatgpt, cohere)

**Response:**
```json
{
  "id": "aws",
  "name": "Amazon Web Services",
  "enabled": true,
  "currentCost": 2.20,
  "lastUpdated": "2025-10-14T00:00:00.000Z"
}
```

### PUT /api/services/:serviceId

Update service configuration.

**Parameters:**
- `serviceId` (path): Service identifier

**Body:**
```json
{
  "enabled": true,
  "name": "Custom Service Name"
}
```

**Response:**
```json
{
  "success": true,
  "serviceId": "aws"
}
```

### GET /api/services/meta/supported

Get list of all supported service types.

**Response:**
```json
{
  "services": ["aws", "gcp", "google-workspace", "atlassian", "chatgpt", "cohere"]
}
```

---

## Costs

### GET /api/costs

Get cost data with optional filters.

**Query Parameters:**
- `serviceId` (optional): Filter by service ID
- `startDate` (optional): ISO date string (e.g., "2025-10-01")
- `endDate` (optional): ISO date string
- `limit` (optional): Max results (default: 100)

**Response:**
```json
{
  "costs": [
    {
      "id": "abc123",
      "serviceId": "aws",
      "totalCost": 0.15,
      "currency": "USD",
      "timestamp": "2025-10-14T00:00:00.000Z",
      "resources": [
        {
          "resourceId": "i-1234567890",
          "name": "EC2 Instance",
          "type": "EC2",
          "cost": 0.15,
          "tags": {
            "Environment": "Production"
          }
        }
      ]
    }
  ],
  "count": 1
}
```

### GET /api/costs/summary

Get cost summary aggregated by service.

**Query Parameters:**
- `startDate` (optional): ISO date string
- `endDate` (optional): ISO date string

**Response:**
```json
{
  "summary": {
    "aws": {
      "totalCost": 2.20,
      "count": 14,
      "currency": "USD",
      "firstTimestamp": "2025-10-01T00:00:00.000Z",
      "lastTimestamp": "2025-10-14T00:00:00.000Z"
    },
    "gcp": {
      "totalCost": 0.00,
      "count": 0,
      "currency": "USD",
      "firstTimestamp": null,
      "lastTimestamp": null
    }
  },
  "totalCost": 4.32,
  "lastUpdated": "2025-10-14T00:00:00.000Z"
}
```

### GET /api/costs/:serviceId/resources

Get resource-level cost breakdown for a service.

**Parameters:**
- `serviceId` (path): Service identifier

**Query Parameters:**
- `startDate` (optional): ISO date string
- `endDate` (optional): ISO date string
- `tags` (optional): JSON string of tag filters (e.g., `{"Environment":"Production"}`)

**Response:**
```json
{
  "resources": [
    {
      "resourceId": "i-1234567890",
      "resourceType": "EC2",
      "totalCost": 2.20,
      "tags": {
        "Environment": "Production"
      },
      "dataPoints": [
        {
          "timestamp": "2025-10-14T00:00:00.000Z",
          "cost": 0.15
        }
      ]
    }
  ],
  "count": 1
}
```

### POST /api/costs/collect

Trigger manual cost collection for a service.

**Body:**
```json
{
  "serviceId": "aws"
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Cost collection completed",
  "serviceId": "aws",
  "costsCollected": 14,
  "newRecords": 0,
  "updatedRecords": 14,
  "timestamp": "2025-10-14T18:15:19.887Z",
  "warning": null
}
```

**Response Fields:**
- `costsCollected`: Total number of cost records processed
- `newRecords`: Number of new records created
- `updatedRecords`: Number of existing records updated (prevents duplicates)

**Response (With Warning):**
```json
{
  "success": true,
  "message": "Cost collection completed",
  "serviceId": "chatgpt",
  "costsCollected": 1,
  "timestamp": "2025-10-14T18:22:17.814Z",
  "warning": "No OpenAI API usage detected in the last 7 days. If you have usage, check your OpenAI dashboard."
}
```

**Error Response:**
```json
{
  "error": "No credentials configured for this service",
  "serviceId": "aws"
}
```

### DELETE /api/costs/:costId

Delete a specific cost entry.

**Parameters:**
- `costId` (path): Cost document ID

**Response:**
```json
{
  "success": true,
  "costId": "abc123",
  "message": "Cost entry deleted"
}
```

---

## Collection Status

### GET /api/costs/status/all

Get collection status for all services. Shows success/failure of last cost collection attempt.

**Response:**
```json
{
  "statuses": {
    "aws": {
      "serviceId": "aws",
      "status": "success",
      "lastRun": "2025-10-14T18:15:19.887Z",
      "costsCollected": 14,
      "warning": null,
      "error": null
    },
    "gcp": {
      "serviceId": "gcp",
      "status": "error",
      "lastRun": "2025-10-14T18:00:00.000Z",
      "costsCollected": 0,
      "warning": null,
      "error": "BigQuery table not found"
    }
  }
}
```

**Status Values:**
- `success`: Collection completed successfully
- `error`: Collection failed

**Fields:**
- `serviceId`: Service identifier
- `status`: Current status (success/error)
- `lastRun`: ISO timestamp of last collection attempt
- `costsCollected`: Number of cost records collected
- `warning`: Warning message (if any)
- `error`: Error message (if collection failed)

---

## Credentials

### GET /api/credentials

Get list of configured credentials (encrypted/masked).

**Response:**
```json
{
  "credentials": [
    {
      "serviceId": "aws",
      "configured": true,
      "credentialType": "api_key",
      "lastUpdated": "2025-10-14T00:00:00.000Z"
    }
  ]
}
```

### GET /api/credentials/:serviceId

Get credential details for a specific service (masked).

**Parameters:**
- `serviceId` (path): Service identifier

**Response:**
```json
{
  "serviceId": "aws",
  "configured": true,
  "credentialType": "api_key",
  "lastUpdated": "2025-10-14T00:00:00.000Z"
}
```

### POST /api/credentials/:serviceId

Save credentials for a service.

**Parameters:**
- `serviceId` (path): Service identifier

**Body (AWS):**
```json
{
  "credentials": {
    "accessKeyId": "AKIAIOSFODNN7EXAMPLE",
    "secretAccessKey": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
    "region": "us-east-1"
  },
  "credentialType": "api_key"
}
```

**Body (GCP):**
```json
{
  "credentials": {
    "type": "service_account",
    "project_id": "my-project",
    "private_key_id": "...",
    "private_key": "...",
    "client_email": "...",
    "client_id": "...",
    "auth_uri": "...",
    "token_uri": "...",
    "auth_provider_x509_cert_url": "...",
    "client_x509_cert_url": "..."
  },
  "credentialType": "service_account",
  "billingAccountId": "01C55A-05863D-B3C399"
}
```

**Response:**
```json
{
  "success": true,
  "serviceId": "aws",
  "message": "Credentials saved successfully"
}
```

### POST /api/credentials/:serviceId/reveal

Reveal masked credentials (for editing).

**Parameters:**
- `serviceId` (path): Service identifier

**Response:**
```json
{
  "serviceId": "aws",
  "credentials": {
    "accessKeyId": "AKIAIOSFODNN7EXAMPLE",
    "secretAccessKey": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
    "region": "us-east-1"
  },
  "credentialType": "api_key"
}
```

### POST /api/credentials/:serviceId/test

Test credentials without saving.

**Parameters:**
- `serviceId` (path): Service identifier

**Body:**
```json
{
  "credentials": {
    "accessKeyId": "AKIAIOSFODNN7EXAMPLE",
    "secretAccessKey": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
    "region": "us-east-1"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Credentials are valid"
}
```

### DELETE /api/credentials/:serviceId

Delete credentials for a service.

**Parameters:**
- `serviceId` (path): Service identifier

**Response:**
```json
{
  "success": true,
  "serviceId": "aws",
  "message": "Credentials deleted"
}
```

---

## Schedules

### GET /api/schedules

Get all configured schedules.

**Response:**
```json
{
  "schedules": [
    {
      "serviceId": "aws",
      "enabled": true,
      "frequency": "daily",
      "time": "09:00",
      "timezone": "UTC",
      "lastRun": "2025-10-14T09:00:00.000Z",
      "nextRun": "2025-10-15T09:00:00.000Z"
    }
  ]
}
```

### GET /api/schedules/:serviceId

Get schedule for a specific service.

**Parameters:**
- `serviceId` (path): Service identifier

**Response:**
```json
{
  "serviceId": "aws",
  "enabled": true,
  "frequency": "daily",
  "time": "09:00",
  "timezone": "UTC",
  "lastRun": "2025-10-14T09:00:00.000Z",
  "nextRun": "2025-10-15T09:00:00.000Z"
}
```

### PUT /api/schedules/:serviceId

Update schedule configuration.

**Parameters:**
- `serviceId` (path): Service identifier

**Body:**
```json
{
  "enabled": true,
  "frequency": "daily",
  "time": "09:00",
  "timezone": "UTC"
}
```

**Frequency Options:**
- `hourly`: Every hour
- `daily`: Once per day at specified time
- `weekly`: Once per week (Monday at specified time)

**Response:**
```json
{
  "success": true,
  "serviceId": "aws",
  "message": "Schedule updated"
}
```

### DELETE /api/schedules/:serviceId

Delete schedule for a service.

**Parameters:**
- `serviceId` (path): Service identifier

**Response:**
```json
{
  "success": true,
  "serviceId": "aws",
  "message": "Schedule deleted"
}
```

### POST /api/schedules/:serviceId/run

Manually trigger a scheduled collection.

**Parameters:**
- `serviceId` (path): Service identifier

**Response:**
```json
{
  "success": true,
  "message": "Collection triggered",
  "serviceId": "aws"
}
```

---

## Backfill

### POST /api/backfill

Create a backfill job to import historical cost data.

**Body:**
```json
{
  "serviceId": "aws",
  "startDate": "2025-09-01",
  "endDate": "2025-09-30"
}
```

**Response:**
```json
{
  "success": true,
  "jobId": "job_abc123",
  "message": "Backfill job created",
  "serviceId": "aws",
  "startDate": "2025-09-01",
  "endDate": "2025-09-30"
}
```

### GET /api/backfill/jobs

Get list of all backfill jobs.

**Query Parameters:**
- `serviceId` (optional): Filter by service
- `status` (optional): Filter by status (pending, running, completed, failed)

**Response:**
```json
{
  "jobs": [
    {
      "id": "job_abc123",
      "serviceId": "aws",
      "startDate": "2025-09-01",
      "endDate": "2025-09-30",
      "status": "completed",
      "progress": 100,
      "costsCollected": 180,
      "createdAt": "2025-10-14T10:00:00.000Z",
      "completedAt": "2025-10-14T10:05:00.000Z"
    }
  ]
}
```

### GET /api/backfill/jobs/:jobId

Get status of a specific backfill job.

**Parameters:**
- `jobId` (path): Job identifier

**Response:**
```json
{
  "id": "job_abc123",
  "serviceId": "aws",
  "startDate": "2025-09-01",
  "endDate": "2025-09-30",
  "status": "running",
  "progress": 45,
  "costsCollected": 81,
  "createdAt": "2025-10-14T10:00:00.000Z",
  "error": null
}
```

### DELETE /api/backfill/jobs/:jobId

Delete a backfill job.

**Parameters:**
- `jobId` (path): Job identifier

**Response:**
```json
{
  "success": true,
  "jobId": "job_abc123",
  "message": "Backfill job deleted"
}
```

---

## Budgets

### GET /api/budgets

Get all configured budgets across all services.

**Response:**
```json
{
  "budgets": [
    {
      "serviceId": "aws",
      "name": "Monthly AWS Budget",
      "amount": 100,
      "currency": "USD",
      "period": "monthly",
      "alertThreshold": 80,
      "notificationChannels": ["email@example.com"],
      "currentSpend": 45.20,
      "percentUsed": 45.2
    }
  ]
}
```

### GET /api/budgets/:serviceId

Get budgets for a specific service.

**Parameters:**
- `serviceId` (path): Service identifier

**Response:**
```json
{
  "budgets": [
    {
      "name": "Monthly AWS Budget",
      "amount": 100,
      "currency": "USD",
      "period": "monthly",
      "alertThreshold": 80,
      "notificationChannels": ["email@example.com"],
      "currentSpend": 45.20,
      "percentUsed": 45.2
    }
  ]
}
```

---

## Error Responses

All endpoints return errors in the following format:

```json
{
  "error": "Error message describing what went wrong"
}
```

Common HTTP status codes:
- `200`: Success
- `400`: Bad request (missing/invalid parameters)
- `404`: Resource not found
- `500`: Server error

---

## Rate Limiting

Currently no rate limiting is enforced, but this may change in future versions.

---

## Authentication

Currently no authentication is required. This is suitable for internal use only. Multi-user authentication is planned for future releases.

---

## CORS

CORS is enabled for all origins in development. In production, only the configured frontend URL is allowed.

---

## Changelog

### 2025-10-14 (v1.3.1)
- **Implemented automatic deduplication** for cost records
- Cost records now use composite unique IDs: `{serviceId}_{YYYY-MM-DD}`
- Multiple collections of same date now update existing records instead of creating duplicates
- Added `newRecords` and `updatedRecords` fields to collection response
- Added `createdAt` and `updatedAt` timestamps to cost records

### 2025-10-14 (v1.3.0)
- Added `GET /api/costs/status/all` endpoint for health status monitoring
- Added collection status tracking to `POST /api/costs/collect`
- Updated cost collection to record success/failure status in Firestore

### Previous Updates
- AWS Cost Explorer integration
- GCP BigQuery billing export integration
- Budget and alerts display
- All service collectors (AWS, GCP, Google Workspace, Atlassian, ChatGPT, Cohere)
