# AI Model Derivative Registration Refactoring

## Overview

This document describes the refactoring of AI model registration to ensure **all AI models are registered as derivatives of their training images**, as required by Story Protocol best practices.

## Problem Statement

### Original Issue

- Training was successful but derivative IP registration was failing
- Database showed `ip_id: null` for trained models
- No derivative registration transactions appeared on Story Protocol explorer

### Root Cause Analysis

Through detailed investigation, we identified the core issue:

**Training images were registered without license terms, preventing them from being used as parent IPs for derivative registration.**

### Error Details

```
"License terms id 1 must be attached to the parent ipId 0x8dFC110B74693eE6cda8Eb5a2c2a8aa54e6347F2 before registering derivative."
```

## Solution Implementation

### 1. License Terms Requirement Fix

**Issue**: `mintAndRegisterIpAndMakeDerivative` required one license terms ID per parent IP, but we were only providing one.

**Before**:

```typescript
licenseTermsIds: [BigInt(params.licenseTermsId)], // ❌ Only one ID for multiple parents
```

**After**:

```typescript
licenseTermsIds: params.parentIpIds.map(() => BigInt(params.licenseTermsId)), // ✅ One ID per parent
```

### 2. Enforced Derivative-Only Registration

**Before**: AI models could fall back to standalone registration if derivative registration failed.

**After**: AI models MUST be derivatives - no fallback allowed.

```typescript
// AI models must ALWAYS be derivatives of training images
if (registeredImageIPs.length === 0) {
  console.error(
    `❌ [IP_REGISTRATION] No training images registered as IP assets. Cannot register AI model.`
  )
  console.error(
    `❌ [IP_REGISTRATION] AI models must be derivatives of training images. Aborting registration.`
  )
  return
}
```

### 3. Enhanced Logging

Added comprehensive logging throughout the registration process:

- `[IP_REGISTRATION]` prefix for all model registration logs
- Detailed parameter tracking
- Parent IP relationship validation
- Error context preservation

### 4. Future Training Image Registration

Updated training image registration to use license terms from the start:

```typescript
// Use PIL terms registration for training images to enable derivative relationships
const ipResult = await withRetry(async () => {
  return await mintAndRegisterIpWithPilTerms({
    spgNftContract: spgContract,
    metadata: ipMetadata,
  })
})
```

## Architecture Changes

### File Changes

1. **`lib/story-protocol.ts`**:

   - Renamed `registerDerivativeWithLicenseTerms` → `mintAndRegisterIpAndMakeDerivative`
   - Fixed license terms ID mapping for multiple parents
   - Added `mintAndRegisterIpWithPilTerms` for future training images

2. **`app/api/replicate-webhook/route.ts`**:

   - Removed license token minting approach
   - Simplified to direct derivative registration
   - Enforced derivative-only policy
   - Enhanced error handling and logging

3. **`app/api/process-uploaded-files/route.ts`**:
   - Updated to use `mintAndRegisterIpWithPilTerms` for training images
   - Ensures license terms are attached during registration

## Story Protocol IP Hierarchy

The refactored system creates a clean three-tier IP hierarchy:

```
Training Images (with license terms)
          ↓
     AI Model (derivative)
          ↓
Generated Images (future derivatives)
```

### Benefits

- **Proper IP relationships**: All AI models are derivatives of training data
- **License compliance**: Automatic license propagation from training images
- **Future-ready**: Generated images can be derivatives of AI models
- **No license token complexity**: Direct license terms approach

## Testing Results

### Successful Test Cases

1. ✅ Training image IP registration with license terms
2. ✅ AI model derivative registration with proper license terms mapping
3. ✅ Enhanced logging and error reporting
4. ✅ Database updates with derivative relationships

### Error Handling

- **No parent IPs**: Registration aborts with clear error message
- **Derivative failure**: No fallback to standalone registration
- **License terms missing**: Clear error pointing to root cause

## Deployment Notes

### For Existing Models

- Existing models without derivative relationships will remain as-is
- New webhook events will trigger the enhanced derivative registration
- Manual re-registration possible via webhook replay

### For New Training Jobs

- Training images automatically registered with license terms
- AI models automatically registered as derivatives
- Full IP hierarchy established from the start

## Monitoring

### Key Metrics to Track

1. **Derivative Registration Success Rate**: Should be 100% for new models
2. **License Terms Attachment**: All training images should have license terms
3. **IP Hierarchy Completeness**: Every AI model should have parent IPs
4. **Transaction Success**: Monitor Story Protocol transactions

### Log Patterns to Watch

- `✅ [IP_REGISTRATION] Successfully registered AI model as derivative IP`
- `❌ [IP_REGISTRATION] AI models must be derivatives. No fallback to standalone registration.`
- `🔗 [IP_REGISTRATION] Registering AI model as derivative of N training image IPs`

## Future Enhancements

### Generated Image Derivatives

Ready to implement generated image registration as derivatives:

```typescript
await mintAndRegisterIpAndMakeDerivative({
  spgNftContract: spgContract,
  parentIpIds: [aiModelIpId], // Generated image derives from AI model
  licenseTermsId: "1",
  metadata: generatedImageMetadata,
})
```

### Batch Processing

- Batch training image registration for improved efficiency
- Batch derivative registration for multiple AI models
- Optimized gas usage patterns

## Conclusion

This refactoring ensures that:

1. **All AI models are properly registered as derivatives** of their training images
2. **License terms flow correctly** through the IP hierarchy
3. **The system is future-ready** for generated image derivative registration
4. **Error handling is comprehensive** with clear debugging information

The implementation follows Story Protocol best practices and establishes a solid foundation for intellectual property management in AI training workflows.
