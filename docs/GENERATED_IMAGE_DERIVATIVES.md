# Generated Image Derivative Registration

## Overview

This feature automatically registers all AI-generated images as derivative IP assets of the AI models that created them, establishing a complete IP hierarchy on Story Protocol.

## IP Hierarchy

The system creates a three-tier IP asset hierarchy:

```
Training Images → AI Model → Generated Images
     (Parents)  →  (Child)  →   (Grandchildren)
```

### Tier 1: Training Images

- **Source**: User-uploaded training data
- **Registration**: During training job processing via `mintAndRegisterIpWithPilTerms`
- **License Terms**: Attached during initial registration
- **Role**: Parent IP assets for AI models

### Tier 2: AI Models

- **Source**: Replicate training completion
- **Registration**: Via `mintAndRegisterIpAndMakeDerivative` in training webhook
- **Parents**: All training images used for training
- **Role**: Derivative of training images, parent of generated images

### Tier 3: Generated Images

- **Source**: Image generation completion via Flux models
- **Registration**: Via `mintAndRegisterIpAndMakeDerivative` in image generation webhook
- **Parent**: The AI model that generated the image
- **Role**: Derivative of AI model

## Implementation

### Database Schema

New columns added to `image_generations` table:

```sql
-- IP Asset identification
ip_id TEXT                        -- Story Protocol IP Asset ID
story_image_tx_hash TEXT          -- Image IP registration transaction
story_derivative_tx_hash TEXT     -- Derivative relationship transaction
story_parent_model_ip_id TEXT     -- Parent AI model IP ID
story_registration_status TEXT    -- pending, registered, failed
```

### Registration Flow

#### 1. Image Generation Completion

When an image generation succeeds in the webhook (`app/api/image-generation-webhook/route.ts`):

1. **Image Storage**: Download and store in Supabase Storage
2. **Derivative Registration**: Call `registerGeneratedImageAsDerivative()` (non-blocking)
3. **Database Update**: Store IP information in generation record

#### 2. Derivative Registration Process

The `registerGeneratedImageAsDerivative()` function:

1. **Validation**: Verify Story Protocol configuration
2. **Model Lookup**: Get AI model details and IP ID from database
3. **Metadata Creation**: Build comprehensive metadata for the generated image
4. **IP Registration**: Call `mintAndRegisterIpAndMakeDerivative` with:
   - **Parent IP**: AI model IP ID
   - **License Terms**: Default license terms (ID: "1")
   - **Metadata**: Rich metadata with generation details
5. **Database Update**: Store IP information in generation record

### Metadata Structure

Generated images include comprehensive metadata:

```typescript
{
  title: "Generated Image: [prompt snippet]...",
  description: "AI-generated image created using the '[trigger_word]' model...",
  ipType: "image",
  attributes: [
    { trait_type: "Content Type", value: "AI Generated Image" },
    { trait_type: "Model Trigger Word", value: trigger_word },
    { trait_type: "Generation Prompt", value: user_prompt },
    { trait_type: "Full Prompt", value: prompt_with_trigger },
    { trait_type: "Image Size", value: aspect_ratio },
    { trait_type: "Generation ID", value: generation_uuid },
    { trait_type: "Replicate Prediction ID", value: prediction_id }
  ]
}
```

## Features

### ✅ Automatic Registration

- **Trigger**: Image generation webhook completion
- **Timing**: Non-blocking background process
- **Reliability**: Error handling with comprehensive logging

### ✅ Complete IP Lineage

- **Traceability**: Every generated image traces back to training data
- **Hierarchy**: Three-tier parent-child relationships
- **Transparency**: Full generation metadata on-chain

### ✅ License Propagation

- **Inheritance**: Generated images inherit AI model licenses
- **Compliance**: Automatic license term application
- **Rights Management**: Clear IP ownership chain

### ✅ Error Handling

- **Graceful Degradation**: IP registration failure doesn't break image generation
- **Comprehensive Logging**: Detailed error tracking with `[DERIVATIVE_IP]` prefix
- **Status Tracking**: Database status field for monitoring

## Configuration

### Environment Variables

- `NEXT_PUBLIC_SUPABASE_URL`: Database connection
- `SUPABASE_SERVICE_ROLE_KEY`: Database admin access
- `STORY_PROTOCOL_*`: Story Protocol configuration
- `REPLICATE_WEBHOOK_TUNNEL_URL`: Webhook endpoint for development

### Prerequisites

1. ✅ Story Protocol wallet configured
2. ✅ AI model registered as derivative IP
3. ✅ Training images registered with license terms
4. ✅ Image generation webhook functional

## Testing

### Test Results ✅

- **Generated Image IP**: `0xE31a9352685b2eE76b42e251e08F96237c048e1a`
- **Parent AI Model IP**: `0xd66c67e0906aE7b7FE284a6762deDf0c21075FD5`
- **Transaction**: `0x5680c9084b91d07a99b0a338803ef5ee57afccd12b950e221a24aba6b921578f`
- **Status**: ✅ Successfully verified on Story Protocol

### Manual Testing

1. Generate image using existing AI model with IP ID
2. Check webhook logs for derivative registration
3. Verify transaction on Story Protocol explorer
4. Confirm database record updates

## Monitoring

### Log Prefixes

- `🎨 [DERIVATIVE_IP]`: Derivative registration events
- `✅ [DERIVATIVE_IP]`: Successful operations
- `❌ [DERIVATIVE_IP]`: Error conditions
- `📝 [DERIVATIVE_IP]`: Information/debugging

### Database Queries

```sql
-- Check registration status
SELECT
  id,
  ip_id,
  story_registration_status,
  story_parent_model_ip_id,
  prompt
FROM image_generations
WHERE story_registration_status = 'registered';

-- IP hierarchy view
SELECT
  tj.trigger_word,
  tj.ip_id as model_ip,
  ig.prompt,
  ig.ip_id as image_ip,
  ig.story_parent_model_ip_id
FROM training_jobs tj
JOIN image_generations ig ON tj.replicate_job_id = ig.model_id
WHERE ig.ip_id IS NOT NULL;
```

## Future Enhancements

### Planned Features

1. **Batch Registration**: Register multiple images in single transaction
2. **Custom License Terms**: Allow different license terms per generation
3. **Revenue Sharing**: Implement royalty distribution to training data owners
4. **IP Analytics**: Dashboard showing IP hierarchy and relationships

### Database Migration

When ready to deploy to production, apply the database migration:

```sql
-- Add IP Asset fields to image_generations table
ALTER TABLE image_generations
ADD COLUMN IF NOT EXISTS ip_id TEXT,
ADD COLUMN IF NOT EXISTS story_image_tx_hash TEXT,
ADD COLUMN IF NOT EXISTS story_derivative_tx_hash TEXT,
ADD COLUMN IF NOT EXISTS story_parent_model_ip_id TEXT,
ADD COLUMN IF NOT EXISTS story_registration_status TEXT DEFAULT 'pending';
```

## Security Considerations

### Private Key Management

- **Backend Wallet**: All transactions use secure backend wallet
- **Environment Variables**: Private keys stored securely
- **Gas Management**: Automatic gas estimation and funding

### Error Handling

- **Non-Blocking**: IP registration doesn't affect core image generation
- **Retry Logic**: Could be enhanced with retry mechanisms
- **Fallback**: Image generation succeeds even if IP registration fails

## Conclusion

This feature completes the IP asset ecosystem by automatically creating derivative relationships for all generated content. Every AI-generated image is now properly registered as intellectual property with clear lineage back to the original training data, enabling full IP rights management and potential revenue sharing in the future.
