-- AI Model Derivative Registration Diagnostic Script
-- This script analyzes the current state of AI model derivative registration
-- and identifies issues with license terms and parent IP relationships

-- ========================================
-- 1. OVERVIEW: Training Jobs and AI Models
-- ========================================

SELECT 'TRAINING JOBS OVERVIEW' as section;

SELECT 
  status,
  COUNT(*) as count,
  COUNT(CASE WHEN ip_id IS NOT NULL THEN 1 END) as with_ip_id,
  COUNT(CASE WHEN ip_id IS NULL THEN 1 END) as without_ip_id,
  ROUND(
    COUNT(CASE WHEN ip_id IS NOT NULL THEN 1 END) * 100.0 / COUNT(*), 2
  ) as ip_registration_percentage
FROM training_jobs 
GROUP BY status
ORDER BY 
  CASE status 
    WHEN 'succeeded' THEN 1 
    WHEN 'failed' THEN 2 
    WHEN 'processing' THEN 3 
    ELSE 4 
  END;

-- ========================================
-- 2. SUCCESSFUL MODELS WITHOUT IP REGISTRATION
-- ========================================

SELECT 'SUCCESSFUL MODELS WITHOUT AI MODEL IP' as section;

SELECT 
  id,
  replicate_job_id,
  trigger_word,
  completed_at,
  story_parent_ip_ids,
  array_length(story_parent_ip_ids, 1) as parent_ip_count,
  ip_registration_failed,
  ip_registration_error,
  ip_registration_failed_at
FROM training_jobs 
WHERE status = 'succeeded' 
  AND ip_id IS NULL
ORDER BY completed_at DESC
LIMIT 20;

-- ========================================
-- 3. TRAINING IMAGE IP REGISTRATION STATUS
-- ========================================

SELECT 'TRAINING IMAGES IP STATUS' as section;

WITH training_image_stats AS (
  SELECT 
    tj.id as training_job_id,
    tj.trigger_word,
    tj.status as job_status,
    tj.ip_id as model_ip_id,
    COUNT(ti.id) as total_images,
    COUNT(CASE WHEN ti.story_ip_id IS NOT NULL THEN 1 END) as images_with_ip,
    COUNT(CASE WHEN ti.story_registration_status = 'registered' THEN 1 END) as images_registered,
    COUNT(CASE WHEN ti.story_registration_status = 'failed' THEN 1 END) as images_failed,
    COUNT(CASE WHEN ti.story_registration_status = 'pending' THEN 1 END) as images_pending
  FROM training_jobs tj
  LEFT JOIN training_images ti ON tj.id = ti.training_job_id
  WHERE tj.status = 'succeeded'
  GROUP BY tj.id, tj.trigger_word, tj.status, tj.ip_id
)
SELECT 
  training_job_id,
  trigger_word,
  model_ip_id IS NOT NULL as has_model_ip,
  total_images,
  images_registered,
  images_failed,
  images_pending,
  CASE 
    WHEN total_images = 0 THEN 'No individual images (assets flow)'
    WHEN images_registered = total_images THEN 'All images registered'
    WHEN images_registered = 0 THEN 'No images registered'
    ELSE 'Partial registration'
  END as registration_status
FROM training_image_stats
ORDER BY training_job_id DESC
LIMIT 20;

-- ========================================
-- 4. TRAINING FLOWS ANALYSIS
-- ========================================

SELECT 'TRAINING FLOWS ANALYSIS' as section;

WITH flow_analysis AS (
  SELECT 
    tj.id,
    tj.trigger_word,
    tj.status,
    tj.ip_id IS NOT NULL as has_model_ip,
    tj.story_parent_ip_ids IS NOT NULL as has_parent_ip_ids,
    array_length(tj.story_parent_ip_ids, 1) as parent_ip_count,
    COUNT(ti.id) as individual_images_count,
    COUNT(CASE WHEN ti.story_ip_id IS NOT NULL THEN 1 END) as individual_images_with_ip,
    CASE 
      WHEN COUNT(ti.id) > 0 THEN 'Individual Images Flow'
      WHEN tj.story_parent_ip_ids IS NOT NULL THEN 'Assets Flow' 
      ELSE 'Unknown Flow'
    END as detected_flow
  FROM training_jobs tj
  LEFT JOIN training_images ti ON tj.id = ti.training_job_id
  WHERE tj.status = 'succeeded'
  GROUP BY tj.id, tj.trigger_word, tj.status, tj.ip_id, tj.story_parent_ip_ids
)
SELECT 
  detected_flow,
  COUNT(*) as jobs_count,
  COUNT(CASE WHEN has_model_ip THEN 1 END) as with_model_ip,
  COUNT(CASE WHEN NOT has_model_ip THEN 1 END) as without_model_ip,
  ROUND(
    COUNT(CASE WHEN has_model_ip THEN 1 END) * 100.0 / COUNT(*), 2
  ) as model_ip_success_rate
FROM flow_analysis
GROUP BY detected_flow
ORDER BY jobs_count DESC;

-- ========================================
-- 5. MODELS WITH FAILED IP REGISTRATION
-- ========================================

SELECT 'FAILED IP REGISTRATIONS' as section;

SELECT 
  id,
  replicate_job_id,
  trigger_word,
  completed_at,
  ip_registration_failed,
  ip_registration_error,
  ip_registration_failed_at,
  story_parent_ip_ids IS NOT NULL as has_parent_ips,
  array_length(story_parent_ip_ids, 1) as parent_ip_count
FROM training_jobs 
WHERE status = 'succeeded' 
  AND ip_registration_failed = true
ORDER BY ip_registration_failed_at DESC
LIMIT 10;

-- ========================================
-- 6. PARENT IP VALIDATION
-- ========================================

SELECT 'PARENT IP VALIDATION NEEDED' as section;

-- Jobs that should have derivative registration but don't
SELECT 
  tj.id,
  tj.replicate_job_id,
  tj.trigger_word,
  tj.completed_at,
  tj.ip_id IS NOT NULL as has_model_ip,
  CASE 
    WHEN COUNT(ti.id) > 0 THEN 'Individual Images'
    WHEN tj.story_parent_ip_ids IS NOT NULL THEN 'Assets'
    ELSE 'No Parent IPs'
  END as expected_flow,
  COUNT(CASE WHEN ti.story_ip_id IS NOT NULL AND ti.story_registration_status = 'registered' THEN 1 END) as registered_training_images,
  array_length(tj.story_parent_ip_ids, 1) as parent_ip_count,
  CASE 
    WHEN COUNT(ti.id) > 0 AND COUNT(CASE WHEN ti.story_ip_id IS NOT NULL AND ti.story_registration_status = 'registered' THEN 1 END) = 0 THEN 'Training images not registered'
    WHEN COUNT(ti.id) = 0 AND tj.story_parent_ip_ids IS NULL THEN 'No parent IPs found'
    WHEN COUNT(ti.id) > 0 AND COUNT(CASE WHEN ti.story_ip_id IS NOT NULL AND ti.story_registration_status = 'registered' THEN 1 END) > 0 AND tj.ip_id IS NULL THEN 'Should be derivative - retry needed'
    WHEN COUNT(ti.id) = 0 AND tj.story_parent_ip_ids IS NOT NULL AND tj.ip_id IS NULL THEN 'Should be derivative - retry needed'
    ELSE 'Status OK'
  END as issue_diagnosis
FROM training_jobs tj
LEFT JOIN training_images ti ON tj.id = ti.training_job_id
WHERE tj.status = 'succeeded'
GROUP BY tj.id, tj.replicate_job_id, tj.trigger_word, tj.completed_at, tj.ip_id, tj.story_parent_ip_ids
HAVING 
  -- Focus on jobs that should have IP registration but don't
  tj.ip_id IS NULL AND (
    COUNT(CASE WHEN ti.story_ip_id IS NOT NULL AND ti.story_registration_status = 'registered' THEN 1 END) > 0 OR
    tj.story_parent_ip_ids IS NOT NULL
  )
ORDER BY tj.completed_at DESC
LIMIT 15;

-- ========================================
-- 7. RECENT ACTIVITY SUMMARY
-- ========================================

SELECT 'RECENT ACTIVITY (LAST 7 DAYS)' as section;

SELECT 
  DATE(completed_at) as date,
  COUNT(*) as total_completions,
  COUNT(CASE WHEN ip_id IS NOT NULL THEN 1 END) as with_ai_model_ip,
  COUNT(CASE WHEN ip_id IS NULL THEN 1 END) as without_ai_model_ip,
  ROUND(
    COUNT(CASE WHEN ip_id IS NOT NULL THEN 1 END) * 100.0 / COUNT(*), 2
  ) as ai_model_ip_success_rate
FROM training_jobs 
WHERE status = 'succeeded' 
  AND completed_at >= NOW() - INTERVAL '7 days'
GROUP BY DATE(completed_at)
ORDER BY date DESC;

-- ========================================
-- 8. LICENSE TERMS DIAGNOSTIC
-- ========================================

SELECT 'LICENSE TERMS DIAGNOSTIC' as section;

-- Check if recent training images have license terms attached
-- This requires checking the transaction hashes or Story Protocol directly
-- For now, we can identify patterns in the registration methods

WITH recent_registrations AS (
  SELECT 
    ti.id,
    ti.original_filename,
    ti.story_ip_id,
    ti.story_registration_status,
    ti.story_tx_hash,
    tj.trigger_word,
    tj.ip_id as model_ip_id,
    tj.completed_at
  FROM training_images ti
  JOIN training_jobs tj ON ti.training_job_id = tj.id
  WHERE tj.status = 'succeeded'
    AND tj.completed_at >= NOW() - INTERVAL '7 days'
    AND ti.story_registration_status = 'registered'
)
SELECT 
  COUNT(*) as recent_registered_images,
  COUNT(DISTINCT trigger_word) as models_count,
  COUNT(CASE WHEN model_ip_id IS NOT NULL THEN 1 END) as images_with_successful_model_ip,
  COUNT(CASE WHEN model_ip_id IS NULL THEN 1 END) as images_with_failed_model_ip,
  ROUND(
    COUNT(CASE WHEN model_ip_id IS NOT NULL THEN 1 END) * 100.0 / COUNT(*), 2
  ) as model_success_rate_for_registered_images
FROM recent_registrations;

-- ========================================
-- 9. RECOMMENDED ACTIONS
-- ========================================

SELECT 'RECOMMENDED ACTIONS' as section;

WITH action_analysis AS (
  SELECT 
    COUNT(CASE WHEN tj.status = 'succeeded' AND tj.ip_id IS NULL AND (
      EXISTS(SELECT 1 FROM training_images ti WHERE ti.training_job_id = tj.id AND ti.story_registration_status = 'registered') OR
      tj.story_parent_ip_ids IS NOT NULL
    ) THEN 1 END) as models_need_retry,
    
    COUNT(CASE WHEN tj.status = 'succeeded' AND tj.ip_id IS NULL AND NOT EXISTS(
      SELECT 1 FROM training_images ti WHERE ti.training_job_id = tj.id AND ti.story_registration_status = 'registered'
    ) AND tj.story_parent_ip_ids IS NULL THEN 1 END) as models_need_training_image_registration,
    
    COUNT(CASE WHEN tj.status = 'succeeded' AND tj.ip_id IS NOT NULL THEN 1 END) as models_successfully_registered
  FROM training_jobs tj
  WHERE tj.status = 'succeeded'
)
SELECT 
  'Models that need derivative registration retry' as action,
  models_need_retry as count,
  'Use retry-failed-registrations API or webhook replay' as solution
FROM action_analysis
WHERE models_need_retry > 0

UNION ALL

SELECT 
  'Models that need training image registration first' as action,
  models_need_training_image_registration as count,
  'Re-register training images with license terms using register-ip-backend API' as solution
FROM action_analysis
WHERE models_need_training_image_registration > 0

UNION ALL

SELECT 
  'Models successfully registered' as action,
  models_successfully_registered as count,
  'No action needed' as solution
FROM action_analysis;

-- End of diagnostic script 