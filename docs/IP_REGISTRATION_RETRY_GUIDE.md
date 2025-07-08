# IP Registration Retry & Manual Process Guide

This guide covers how to handle AI models that weren't properly registered as IP assets during training completion.

## Quick Start

### Check Status

```bash
npm run ip:status
```

### Retry Failed Registrations (Safe)

```bash
npm run ip:retry:dry    # Dry run first
npm run ip:retry        # Actual retry (5 models)
```

### Bulk Registration (Many Models)

```bash
npm run ip:retry:bulk   # 20 models at once
```

## Problem Overview

AI models should be automatically registered as IP derivatives when training completes via webhook. However, this can fail due to:

1. **Network issues** during webhook processing
2. **Story Protocol rate limiting**
3. **Parent IP assets not ready** at registration time
4. **Database connectivity issues**
5. **Configuration problems**

## Tools & Solutions

### 1. 🔧 Diagnostic SQL Script

Run this in your Supabase SQL editor to analyze the current situation:

```sql
-- Copy and paste content from scripts/diagnose-ip-registrations.sql
```

**Location:** `scripts/diagnose-ip-registrations.sql`

**What it shows:**

- Overall registration statistics
- Breakdown by training flow (assets vs individual images)
- Recent unregistered models
- Models with registration errors
- Success rates over time

### 2. 🚀 Command Line Script

**Location:** `scripts/retry-ip-registrations.js`

**Usage:**

```bash
# Check status
node scripts/retry-ip-registrations.js --dry-run --limit=1

# Retry 5 unregistered models
node scripts/retry-ip-registrations.js --limit=5

# Retry specific model
node scripts/retry-ip-registrations.js --job-id=abc123def456

# Bulk retry (faster for many models)
node scripts/retry-ip-registrations.js --bulk --limit=20

# Force retry all models (even registered ones)
node scripts/retry-ip-registrations.js --force --limit=10
```

**Options:**

- `--dry-run` - Show what would be processed without registering
- `--limit=N` - Number of models to process (default: 10)
- `--force` - Retry all models, even already registered ones
- `--job-id=ID` - Process only specific job (database ID or Replicate ID)
- `--bulk` - Use bulk registration (faster for many models)
- `--help` - Show all options

### 3. 📡 API Endpoints

#### A. Retry Failed Registrations

```bash
# Check status
curl http://localhost:3000/api/retry-failed-registrations

# Retry 5 models
curl -X POST "http://localhost:3000/api/retry-failed-registrations?limit=5"

# Retry specific model
curl -X POST "http://localhost:3000/api/retry-failed-registrations?job_id=abc123"

# Force retry (even registered models)
curl -X POST "http://localhost:3000/api/retry-failed-registrations?force=true&limit=3"
```

#### B. Bulk Registration

```bash
# Dry run - see what would be processed
curl -X POST "http://localhost:3000/api/models/bulk-register-derivatives?dry_run=true&limit=10"

# Actual bulk registration
curl -X POST "http://localhost:3000/api/models/bulk-register-derivatives?limit=10"

# Check summary
curl http://localhost:3000/api/models/bulk-register-derivatives
```

#### C. Individual Model Registration

```bash
# Register specific model (by database ID or Replicate job ID)
curl -X POST http://localhost:3000/api/models/abc123def456/register-derivative
```

## NPM Scripts (Recommended)

Added to `package.json` for convenience:

```bash
npm run ip:status      # Check registration status
npm run ip:retry:dry   # Dry run (safe to test)
npm run ip:retry       # Retry 5 unregistered models
npm run ip:retry:bulk  # Bulk retry 20 models
```

## Understanding the Output

### Success Response

```json
{
  "success": true,
  "ipId": "0x1234...abcd",
  "txHash": "0x5678...efgh",
  "parentIPCount": 8,
  "flow": "assets"
}
```

### Error Responses

```json
{
  "success": false,
  "error": "No parent IP assets found",
  "details": {
    "trainingImagesFlow": 0,
    "assetsFlow": 0,
    "hasParentIPs": false
  }
}
```

## Common Issues & Solutions

### Issue 1: "No parent IP assets found"

**Problem:** Model has no parent IPs from either training flow  
**Solution:** Check if:

- Assets flow: `story_parent_ip_ids` is populated
- Individual images flow: Training images have `story_ip_id` set

### Issue 2: "License terms must be attached"

**Problem:** Parent IP assets don't have license terms  
**Solution:** Re-register parent assets with license terms attached

### Issue 3: "Network timeout" or "Rate limited"

**Problem:** Story Protocol rate limiting or network issues  
**Solution:**

- Use smaller batch sizes (`--limit=3`)
- Add delays between requests
- Retry later

### Issue 4: "Database update failed"

**Problem:** IP registered successfully but database update failed  
**Solution:** Model is registered on-chain, just need to update database with IP ID

## Production Usage

### For Your Current Unregistered Models

1. **First, diagnose the situation:**

   ```bash
   npm run ip:status
   ```

2. **Start with a small test:**

   ```bash
   npm run ip:retry:dry  # See what would happen
   npm run ip:retry      # Try 5 models
   ```

3. **If successful, process more:**

   ```bash
   npm run ip:retry:bulk  # Process 20 at once
   ```

4. **Monitor progress:**
   ```bash
   npm run ip:status  # Check updated statistics
   ```

### Scheduled Automation

You can set up a cron job to automatically retry failed registrations:

```bash
# Add to crontab - retry failed registrations every hour
0 * * * * cd /path/to/project && npm run ip:retry >/dev/null 2>&1
```

## Monitoring & Logging

### Webhook Enhancement

The webhook now stores retry information when registration fails:

- `ip_registration_failed: true`
- `ip_registration_error: "error message"`
- `ip_registration_failed_at: timestamp`

### Log Patterns to Watch

**Success:**

```
✅ [BULK_REGISTRATION] Successfully registered: my-model-name
✅ [WEBHOOK_SIMULATION] Successfully registered AI model as derivative IP: 0x1234...
```

**Failures:**

```
❌ [BULK_REGISTRATION] Failed to register: my-model-name - No parent IP assets found
❌ [WEBHOOK_SIMULATION] No parent IP assets found for derivative registration
```

## Database Schema Changes

The enhanced webhook adds these fields to track retry status:

```sql
ALTER TABLE training_jobs ADD COLUMN IF NOT EXISTS ip_registration_failed BOOLEAN DEFAULT FALSE;
ALTER TABLE training_jobs ADD COLUMN IF NOT EXISTS ip_registration_error TEXT;
ALTER TABLE training_jobs ADD COLUMN IF NOT EXISTS ip_registration_failed_at TIMESTAMPTZ;
```

## Troubleshooting

### Script Won't Run

1. Ensure server is running: `npm run dev`
2. Check environment variables are set
3. Install dependencies: `npm install`

### No Models Found

1. Check database connection
2. Verify models have `status = 'succeeded'`
3. Ensure `trigger_word` and `output_model_url` are not null

### Registration Keeps Failing

1. Check Story Protocol configuration
2. Verify backend wallet has gas tokens
3. Check network connectivity to Story Protocol
4. Review parent IP asset status

### Database Updates Fail

1. Check database permissions
2. Verify Supabase service role key
3. Look for concurrent updates

## Support

If issues persist:

1. **Check logs** in the server console for detailed error messages
2. **Run diagnostic SQL** to understand the current state
3. **Try smaller batches** to isolate problematic models
4. **Check Story Protocol explorer** to verify on-chain status

The system is designed to be safe - you can run retries multiple times without causing duplicate registrations. Already registered models will be skipped automatically.
