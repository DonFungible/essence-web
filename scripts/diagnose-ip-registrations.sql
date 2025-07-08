-- IP Registration Diagnostic Script
-- This script helps identify models that need IP registration or retry

-- 1. Overall IP Registration Statistics
SELECT 
  'Overall Statistics' AS category,
  COUNT(*) AS total_successful_jobs,
  COUNT(CASE WHEN ip_id IS NOT NULL THEN 1 END) AS jobs_with_ip_id,
  COUNT(CASE WHEN ip_id IS NULL THEN 1 END) AS jobs_without_ip_id,
  ROUND(
    COUNT(CASE WHEN ip_id IS NOT NULL THEN 1 END) * 100.0 / COUNT(*), 
    2
  ) AS registration_percentage
FROM training_jobs 
WHERE status = 'succeeded' 
  AND trigger_word IS NOT NULL 
  AND output_model_url IS NOT NULL;

-- 2. Breakdown by Training Flow
SELECT 
  'Training Flow Analysis' AS category,
  CASE 
    WHEN story_parent_ip_ids IS NOT NULL AND array_length(story_parent_ip_ids, 1) > 0 THEN 'Assets Flow'
    WHEN has_individual_images = true THEN 'Individual Images Flow'
    ELSE 'Unknown Flow'
  END AS flow_type,
  COUNT(*) AS total_jobs,
  COUNT(CASE WHEN ip_id IS NOT NULL THEN 1 END) AS registered,
  COUNT(CASE WHEN ip_id IS NULL THEN 1 END) AS unregistered,
  ROUND(
    COUNT(CASE WHEN ip_id IS NOT NULL THEN 1 END) * 100.0 / COUNT(*), 
    2
  ) AS registration_rate
FROM training_jobs 
WHERE status = 'succeeded' 
  AND trigger_word IS NOT NULL 
  AND output_model_url IS NOT NULL
GROUP BY flow_type
ORDER BY total_jobs DESC;

-- 3. Recent Unregistered Models (Last 7 Days)
SELECT 
  'Recent Unregistered Models' AS category,
  id AS job_id,
  replicate_job_id,
  trigger_word,
  completed_at,
  CASE 
    WHEN story_parent_ip_ids IS NOT NULL AND array_length(story_parent_ip_ids, 1) > 0 THEN 'Assets Flow (' || array_length(story_parent_ip_ids, 1) || ' parents)'
    WHEN has_individual_images = true THEN 'Individual Images Flow'
    ELSE 'Unknown Flow'
  END AS flow_info,
  ip_registration_failed,
  ip_registration_error
FROM training_jobs 
WHERE status = 'succeeded' 
  AND trigger_word IS NOT NULL 
  AND output_model_url IS NOT NULL
  AND ip_id IS NULL
  AND completed_at >= NOW() - INTERVAL '7 days'
ORDER BY completed_at DESC
LIMIT 10;

-- 4. Models with Registration Errors
SELECT 
  'Registration Errors' AS category,
  id AS job_id,
  replicate_job_id,
  trigger_word,
  completed_at,
  ip_registration_error,
  ip_registration_failed_at
FROM training_jobs 
WHERE ip_registration_failed = true
  AND completed_at >= NOW() - INTERVAL '30 days'
ORDER BY ip_registration_failed_at DESC
LIMIT 10;

-- 5. Assets Flow Analysis (Models with Parent IPs but no IP ID)
SELECT 
  'Assets Flow Issues' AS category,
  id AS job_id,
  replicate_job_id,
  trigger_word,
  completed_at,
  array_length(story_parent_ip_ids, 1) AS parent_ip_count,
  story_parent_ip_ids[1:3] AS sample_parent_ips -- Show first 3 parent IPs
FROM training_jobs 
WHERE status = 'succeeded' 
  AND ip_id IS NULL
  AND story_parent_ip_ids IS NOT NULL 
  AND array_length(story_parent_ip_ids, 1) > 0
  AND completed_at >= NOW() - INTERVAL '30 days'
ORDER BY completed_at DESC
LIMIT 10;

-- 6. Individual Images Flow Analysis
WITH individual_images_analysis AS (
  SELECT 
    tj.id,
    tj.replicate_job_id,
    tj.trigger_word,
    tj.completed_at,
    tj.ip_id,
    COUNT(ti.id) AS total_training_images,
    COUNT(CASE WHEN ti.story_ip_id IS NOT NULL AND ti.story_registration_status = 'registered' THEN 1 END) AS registered_images
  FROM training_jobs tj
  LEFT JOIN training_images ti ON tj.id = ti.training_job_id
  WHERE tj.status = 'succeeded' 
    AND tj.has_individual_images = true
    AND tj.completed_at >= NOW() - INTERVAL '30 days'
  GROUP BY tj.id, tj.replicate_job_id, tj.trigger_word, tj.completed_at, tj.ip_id
)
SELECT 
  'Individual Images Flow Issues' AS category,
  id AS job_id,
  replicate_job_id,
  trigger_word,
  completed_at,
  total_training_images,
  registered_images,
  CASE 
    WHEN ip_id IS NOT NULL THEN 'Model Registered'
    WHEN registered_images = 0 THEN 'No Images Registered'
    WHEN registered_images < total_training_images THEN 'Partial Image Registration'
    ELSE 'Images Registered, Model Missing'
  END AS issue_type
FROM individual_images_analysis
WHERE ip_id IS NULL OR registered_images = 0
ORDER BY completed_at DESC
LIMIT 10;

-- 7. Success Rate by Date (Last 30 Days)
SELECT 
  'Daily Success Rate' AS category,
  DATE(completed_at) AS completion_date,
  COUNT(*) AS total_jobs,
  COUNT(CASE WHEN ip_id IS NOT NULL THEN 1 END) AS registered_jobs,
  ROUND(
    COUNT(CASE WHEN ip_id IS NOT NULL THEN 1 END) * 100.0 / COUNT(*), 
    2
  ) AS success_rate
FROM training_jobs 
WHERE status = 'succeeded' 
  AND trigger_word IS NOT NULL 
  AND output_model_url IS NOT NULL
  AND completed_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(completed_at)
ORDER BY completion_date DESC
LIMIT 30;

-- 8. Models Ready for Retry (Have Parent IPs but no Model IP)
SELECT 
  'Ready for Retry' AS category,
  COUNT(*) AS total_ready,
  COUNT(CASE WHEN story_parent_ip_ids IS NOT NULL AND array_length(story_parent_ip_ids, 1) > 0 THEN 1 END) AS assets_flow_ready,
  COUNT(CASE WHEN has_individual_images = true THEN 1 END) AS individual_images_ready
FROM training_jobs 
WHERE status = 'succeeded' 
  AND trigger_word IS NOT NULL 
  AND output_model_url IS NOT NULL
  AND ip_id IS NULL
  AND (
    (story_parent_ip_ids IS NOT NULL AND array_length(story_parent_ip_ids, 1) > 0)
    OR has_individual_images = true
  );

-- 9. Example Commands for Manual Retry
SELECT 
  'Manual Retry Commands' AS category,
  'Use these endpoints to retry registration:' AS instruction,
  '1. GET /api/retry-failed-registrations - Check status' AS command_1,
  '2. POST /api/retry-failed-registrations?limit=5 - Retry 5 models' AS command_2,
  '3. POST /api/models/bulk-register-derivatives?limit=10 - Bulk register 10 models' AS command_3,
  '4. POST /api/models/[id]/register-derivative - Register specific model' AS command_4;

-- 10. Environment Check
SELECT 
  'Environment Check' AS category,
  'Verify these environment variables are set:' AS instruction,
  'NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY' AS required_vars_1,
  'STORY_PRIVATE_KEY, BACKEND_WALLET_PK' AS required_vars_2,
  'SPG_NFT_CONTRACT_ADDRESS' AS required_vars_3; 