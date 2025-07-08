# AI Model Derivative Registration Fix

## 🚨 Issue Summary

**Problem**: AI models are not being registered as derivatives of training images on production.

**Root Cause**: Training images are being registered without license terms, which are required for derivative IP registration in Story Protocol.

**Impact**: AI models cannot establish proper IP hierarchy and derivative relationships, breaking the intended IP asset structure.

## 🔍 Technical Root Cause

### The License Terms Requirement

Story Protocol requires parent IP assets to have **license terms attached** before they can be used for derivative registration. The `mintAndRegisterIpAndMakeDerivative` function used for AI models requires:

```typescript
derivData: {
  parentIpIds: params.parentIpIds as `0x${string}`[],
  licenseTermsIds: params.parentIpIds.map(() => BigInt(params.licenseTermsId)),
}
```

### Inconsistent Training Image Registration

The system has multiple training image registration methods:

1. **`app/api/zip-images/route.ts`** (legacy): ❌ Uses `mintAndRegisterIP` (NO license terms)
2. **`app/api/process-uploaded-files/route.ts`** (current): ✅ Uses `mintAndRegisterIpWithPilTerms` (WITH license terms)
3. **`app/api/register-ip-backend/route.ts`** (manual): ❌ Was using `mintAndRegisterIP` (NO license terms)

### The Failure Chain

1. Training images registered without license terms (using old method)
2. AI model training completes successfully
3. Webhook attempts to register AI model as derivative
4. **Story Protocol rejects registration**: "License terms id 1 must be attached to parent ipId before registering derivative"
5. AI model registration fails, `ip_id` remains null

## ✅ Solutions Implemented

### 1. Fixed License Terms Registration

**Updated all endpoints** to use `mintAndRegisterIpWithPilTerms`:

- ✅ `app/api/zip-images/route.ts`: Now uses license terms
- ✅ `app/api/register-ip-backend/route.ts`: Now uses license terms
- ✅ `app/api/process-uploaded-files/route.ts`: Already correct

### 2. Enhanced Error Detection

Added specific error detection in the Replicate webhook:

```typescript
if (errorMessage.includes("license terms") || errorMessage.includes("licenseTermsId")) {
  console.error(`🚨 LICENSE TERMS ERROR: Parent IP assets may not have required license terms`)
  console.error(`🚨 Solution: Re-register training images using mintAndRegisterIpWithPilTerms`)
  console.error(`🚨 Parent IPs needing license terms: ${registeredImageIPs.join(", ")}`)
}
```

### 3. Production Diagnostic Tools

Created comprehensive diagnostic script: `scripts/diagnose-ai-derivative-registration.sql`

Provides analysis of:

- Training jobs with/without IP registration
- Training image IP registration status
- Training flow detection (individual images vs assets)
- Failed registration patterns
- Recommended actions

## 📊 Production Diagnosis

### Step 1: Run Diagnostic Analysis

```bash
# Display the diagnostic SQL script
pnpm diagnose:ai-derivatives

# Copy the output and run it in Supabase SQL Editor
```

This will show:

- How many AI models lack IP registration
- Which training images need license terms
- Specific failure patterns

### Step 2: Identify Affected Models

The diagnostic will categorize issues:

1. **"Should be derivative - retry needed"**: Training images have IP IDs, AI model just needs retry
2. **"Training images not registered"**: Training images need IP registration with license terms first
3. **"No parent IPs found"**: No training data linked (data issue)

## 🛠️ Production Fixes

### For Models with Unregistered Training Images

If training images don't have IP IDs, re-register them with license terms:

```bash
# Get training images for a specific job
curl -X POST $NEXT_PUBLIC_BASE_URL/api/register-ip-backend \
  -H 'Content-Type: application/json' \
  -d '{
    "trainingImages": [
      {
        "id": "image_id",
        "original_filename": "filename.jpg",
        "content_type": "image/jpeg",
        "file_size": 1234567,
        "training_job_id": "job_id"
      }
    ]
  }'
```

### For Models Ready for Derivative Registration

If training images have IP IDs but AI model doesn't, retry registration:

```bash
# Retry specific model
curl -X POST $NEXT_PUBLIC_BASE_URL/api/retry-failed-registrations?models=5

# Bulk retry (up to 20 models)
curl -X POST $NEXT_PUBLIC_BASE_URL/api/retry-failed-registrations?bulk=true
```

### For Manual Model Registration

```bash
# Register specific model as derivative
curl -X POST $NEXT_PUBLIC_BASE_URL/api/models/{model_id}/register-derivative
```

## 📈 Monitoring Success

### Key Metrics to Track

1. **AI Model IP Registration Rate**: Should approach 100% for new models
2. **License Terms Attachment Success**: Monitor for license errors in logs
3. **Derivative Registration Success**: Track successful AI model registrations

### Log Patterns

**Success**:

```
✅ [IP_REGISTRATION] Successfully registered AI model as derivative IP: 0x...
✅ IP registered successfully with license terms: 0x...
```

**License Terms Errors**:

```
🚨 [IP_REGISTRATION] LICENSE TERMS ERROR: Parent IP assets may not have required license terms
🚨 [IP_REGISTRATION] Solution: Re-register training images using mintAndRegisterIpWithPilTerms
```

## 🔄 Prevention for Future

### 1. Consistent Registration Methods

All training image registration now uses `mintAndRegisterIpWithPilTerms` ensuring license terms are attached.

### 2. Enhanced Error Handling

Webhook now detects and logs specific license terms issues with actionable solutions.

### 3. Automated Monitoring

Consider implementing:

- Automated retry for failed registrations
- Dashboard showing IP hierarchy completeness
- Alerts for license terms attachment failures

## 📋 Production Checklist

- [ ] Run diagnostic SQL script in Supabase
- [ ] Identify models needing training image re-registration
- [ ] Identify models ready for derivative registration retry
- [ ] Execute re-registration for training images without license terms
- [ ] Execute retry for AI models with proper parent IPs
- [ ] Monitor logs for successful registrations
- [ ] Verify Story Protocol transactions on chain
- [ ] Update monitoring to track IP registration success rates

## 🎯 Expected Outcomes

After implementing these fixes:

1. **New training jobs**: Training images automatically get license terms
2. **New AI models**: Successfully register as derivatives
3. **Existing affected models**: Can be fixed via retry mechanisms
4. **Complete IP hierarchy**: Training Images → AI Model → Generated Images
5. **Proper license propagation**: Derivative relationships enable license inheritance

The system will now properly establish the three-tier IP asset hierarchy as intended by the Story Protocol integration.
