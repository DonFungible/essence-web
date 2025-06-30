# 🧹 Database Schema Cleanup: Consolidating Redundant Columns

## Overview

This document outlines the database schema cleanup performed to remove redundant and unnecessary columns from the `training_jobs` table, consolidating Story Protocol IP tracking into a single, more maintainable structure.

## Problem Statement

The `training_jobs` table had accumulated redundant columns over multiple migrations:

### Redundant IP ID Columns

- `story_zip_ip_id` - IP ID for ZIP file
- `story_model_ip_id` - IP ID for trained model
- **Issue**: ZIP file and model represent the same IP asset (the training dataset)

### Unnecessary Token/Contract Columns

- `story_zip_token_id` - NFT token ID for ZIP
- `story_model_token_id` - NFT token ID for model
- `story_model_nft_contract` - NFT contract address
- **Issue**: Token IDs and contract addresses not essential for core functionality

### Other Redundant Columns

- `zip_file_size` - File size in bytes
- `story_derivative_tx_hash` - Not effectively used
- `story_model_registration_status` - Can be inferred from IP ID presence

## Solution: Schema Consolidation

### New Consolidated Structure

**Added:**

- `ip_id` - Single Story Protocol IP Asset ID (consolidated from ZIP and model IPs)

**Removed:**

- `zip_file_size`
- `story_zip_token_id`
- `story_model_nft_contract`
- `story_model_token_id`
- `story_zip_ip_id`
- `story_model_ip_id`
- `story_derivative_tx_hash`
- `story_model_registration_status`

**Kept:**

- `story_parent_ip_ids` - Array of parent IP IDs (needed for derivative relationships)
- `story_zip_tx_hash` - Transaction hash for IP registration (verification)
- `story_model_tx_hash` - Transaction hash for model registration (verification)

## Migration Details

### 1. Data Migration Strategy

```sql
-- Priority: story_zip_ip_id (ZIP file IP) over story_model_ip_id (model IP)
UPDATE training_jobs
SET ip_id = COALESCE(story_zip_ip_id, story_model_ip_id)
WHERE story_zip_ip_id IS NOT NULL OR story_model_ip_id IS NOT NULL;
```

### 2. Code Updates

**API Routes Updated:**

- `app/api/process-uploaded-files/route.ts`
- `app/api/zip-images/route.ts`
- `app/api/replicate-webhook/route.ts`

**Key Changes:**

```typescript
// Before
story_zip_ip_id: zipIpId,
story_model_ip_id: modelResult.ipId,
zip_file_size: zipBuffer.byteLength,

// After
ip_id: zipIpId, // or modelResult.ipId
// zip_file_size removed
```

### 3. Database View Updates

```sql
-- Updated story_ip_relationships view to use ip_id
CREATE OR REPLACE VIEW story_ip_relationships AS
SELECT
  tj.id as training_job_id,
  tj.trigger_word,
  tj.ip_id,  -- <-- Updated from story_model_ip_id
  tj.story_parent_ip_ids,
  -- ... rest of view
```

## Benefits

### 1. Simplified Schema

- **Before**: 8 Story Protocol columns
- **After**: 4 Story Protocol columns
- **Reduction**: 50% fewer columns

### 2. Clearer Data Model

- Single source of truth for IP Asset ID
- Eliminates confusion between ZIP and model IPs
- Registration status inferred from `ip_id` presence

### 3. Easier Maintenance

- Fewer columns to manage in queries
- Reduced complexity in API routes
- Cleaner database indexes

### 4. Better Performance

- Fewer columns to scan
- Consolidated indexes
- Simplified JOIN operations

## Updated Column List

### Core Columns (unchanged)

- `id`, `user_id`, `replicate_job_id`, `status`
- `created_at`, `updated_at`
- `trigger_word`, `input_images_url`, `output_model_url`

### Story Protocol Columns (simplified)

- `ip_id` - **NEW**: Consolidated IP Asset ID
- `story_parent_ip_ids` - Array of parent IP IDs
- `story_zip_tx_hash` - ZIP registration transaction
- `story_model_tx_hash` - Model registration transaction

### Other Metadata (unchanged)

- Training parameters, timing data, file paths, etc.

## Migration Scripts

1. **`scripts/016-cleanup-redundant-columns.sql`** - Main migration
2. **`scripts/apply-cleanup-migration.js`** - Migration runner script

## Verification

After migration, verify:

```sql
-- Check new column exists
SELECT ip_id FROM training_jobs LIMIT 1;

-- Verify old columns are gone
SELECT story_zip_ip_id FROM training_jobs; -- Should error

-- Check data migration
SELECT COUNT(*) FROM training_jobs WHERE ip_id IS NOT NULL;
```

## Backward Compatibility

⚠️ **Breaking Changes**:

- Code referencing old column names will need updates
- Any external integrations using these columns must be updated

## Future Considerations

1. **IP Registration Status**: Can be inferred from `ip_id IS NOT NULL`
2. **File Sizes**: Can be retrieved from storage if needed
3. **Token IDs**: Available via Story Protocol API if required
4. **Contract Addresses**: Consistent across platform, stored in config

This cleanup provides a cleaner, more maintainable database schema while preserving all essential functionality for Story Protocol integration.
