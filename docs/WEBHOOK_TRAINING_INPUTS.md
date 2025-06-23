# 🔄 Enhanced Webhook: Training Input Data Storage

## Overview

The webhook has been enhanced to capture and store **training input data** from successful Replicate training jobs. This provides complete visibility into training parameters and metrics.

## 📊 Data Captured

### **Training Inputs** (from `input` object)
- `input_images_url` - URL to the training dataset ZIP file
- `trigger_word` - Model name/trigger word used for generation
- `captioning` - Captioning mode (automatic, manual, disabled)
- `training_steps` - Number of training steps used

### **Timing Data** (from webhook timestamps & metrics)
- `started_at` - When training started (ISO timestamp)
- `completed_at` - When training completed (ISO timestamp)
- `predict_time` - Actual training/prediction time (seconds)
- `total_time` - Total time from start to finish (seconds)

## 🎯 When Data is Stored

| Webhook Status | Data Stored |
|----------------|-------------|
| `starting` | Basic job record created |
| `processing` | Logs and started_at updated |
| **`succeeded`** | **All training inputs + timing data** |
| `failed` | Error message stored |

## 📋 Example Webhook Payload

\`\`\`json
{
  "id": "z5phh5qvaxrma0cqjq6b6fmbc0",
  "status": "succeeded",
  "output": "ffaf718d-a58d-4426-b128-39dc939af6fe",
  "input": {
    "captioning": "automatic",
    "input_images": "https://storage.url/dataset.zip",
    "trigger_word": "MYMODEL",
    "steps": 300
  },
  "metrics": {
    "predict_time": 791.272920881,
    "total_time": 791.282155
  },
  "completed_at": "2025-06-22T04:15:19.625155Z",
  "started_at": "2025-06-22T04:02:08.352234Z",
  "logs": "Fine-tuning completed..."
}
\`\`\`

## 🏗️ Database Schema Changes

The following columns have been added to the `training_jobs` table:

\`\`\`sql
-- Training input data
input_images_url TEXT,     -- Dataset ZIP URL
trigger_word TEXT,         -- Model trigger word
captioning TEXT,           -- Captioning mode
training_steps INTEGER,    -- Number of training steps

-- Timing data
completed_at TIMESTAMP WITH TIME ZONE,  -- Completion time
started_at TIMESTAMP WITH TIME ZONE,    -- Start time
predict_time REAL,         -- Training time (seconds)
total_time REAL           -- Total time (seconds)
\`\`\`

## 🔧 Setup Required

### 1. Apply Database Migration

Run this SQL in your **Supabase SQL Editor**:

\`\`\`sql
-- Add columns for training input data
ALTER TABLE training_jobs 
ADD COLUMN IF NOT EXISTS input_images_url TEXT,
ADD COLUMN IF NOT EXISTS trigger_word TEXT,
ADD COLUMN IF NOT EXISTS captioning TEXT,
ADD COLUMN IF NOT EXISTS training_steps INTEGER,
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS started_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS predict_time REAL,
ADD COLUMN IF NOT EXISTS total_time REAL;

-- Add performance indexes
CREATE INDEX IF NOT EXISTS idx_training_jobs_trigger_word 
ON training_jobs (trigger_word);

CREATE INDEX IF NOT EXISTS idx_training_jobs_completed_at 
ON training_jobs (completed_at DESC);

CREATE INDEX IF NOT EXISTS idx_training_jobs_status 
ON training_jobs (status);
\`\`\`

### 2. Test the Enhanced Webhook

\`\`\`bash
# Show migration SQL
pnpm migrate:training-inputs

# Test complete lifecycle
pnpm test:webhook:lifecycle

# Test successful webhook with training data
pnpm test:webhook:success
\`\`\`

## 📈 Usage Examples

### Query Successful Training Jobs with Inputs

\`\`\`sql
SELECT 
  id,
  replicate_job_id,
  trigger_word,
  input_images_url,
  training_steps,
  captioning,
  predict_time,
  total_time,
  completed_at,
  status
FROM training_jobs 
WHERE status = 'succeeded' 
  AND trigger_word IS NOT NULL
ORDER BY completed_at DESC;
\`\`\`

### Find Training Jobs by Trigger Word

\`\`\`sql
SELECT * FROM training_jobs 
WHERE trigger_word = 'MYMODEL'
ORDER BY created_at DESC;
\`\`\`

### Calculate Average Training Times

\`\`\`sql
SELECT 
  AVG(predict_time) as avg_training_time,
  AVG(total_time) as avg_total_time,
  COUNT(*) as successful_jobs
FROM training_jobs 
WHERE status = 'succeeded' 
  AND predict_time IS NOT NULL;
\`\`\`

## 🔍 Monitoring & Analytics

### Training Performance Metrics
- **Average training time** by training steps
- **Success rate** by captioning mode
- **Dataset size impact** on training duration
- **Popular trigger words** and patterns

### Query Examples

\`\`\`sql
-- Training performance by steps
SELECT 
  training_steps,
  AVG(predict_time) as avg_time,
  COUNT(*) as jobs
FROM training_jobs 
WHERE status = 'succeeded' AND training_steps IS NOT NULL
GROUP BY training_steps
ORDER BY training_steps;

-- Success rate by captioning mode
SELECT 
  captioning,
  COUNT(*) as total_jobs,
  SUM(CASE WHEN status = 'succeeded' THEN 1 ELSE 0 END) as successful,
  ROUND(
    100.0 * SUM(CASE WHEN status = 'succeeded' THEN 1 ELSE 0 END) / COUNT(*), 
    2
  ) as success_rate_percent
FROM training_jobs 
WHERE captioning IS NOT NULL
GROUP BY captioning;
\`\`\`

## 🛠️ Implementation Details

### Webhook Logic

1. **Extract data** from webhook payload
2. **Parse input object** for training parameters
3. **Store timing data** from metrics and timestamps
4. **Handle all statuses** but store inputs only on success
5. **Graceful handling** of missing data fields

### Error Handling

- Missing input data → Logs warning, continues processing
- Invalid timestamps → Skips timestamp fields
- Database errors → Returns 500 with error details

### Performance Optimizations

- **Indexed columns** for fast queries
- **Selective data storage** (inputs only on success)
- **JSON handling** for complex log data

## 🔄 Backward Compatibility

- ✅ Existing webhooks continue to work
- ✅ Old database records remain intact
- ✅ New columns are nullable
- ✅ Gradual data population as new jobs complete

## 🎯 Next Steps

After applying the migration:

1. **Monitor webhook logs** for successful data capture
2. **Build dashboards** using the new training data
3. **Analyze training patterns** for optimization
4. **Set up alerts** for failed training jobs
5. **Create reports** on training performance metrics

This enhancement provides complete visibility into your AI training pipeline! 🚀
