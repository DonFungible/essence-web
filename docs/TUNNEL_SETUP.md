# Local Webhook Tunneling Setup

This guide helps you set up tunneling to test Replicate webhooks locally during development.

## Quick Start

1. **Set up ngrok** (one-time setup):
   \`\`\`bash
   # Sign up at https://ngrok.com and get your auth token
   # Then set it up:
   ngrok config add-authtoken YOUR_AUTH_TOKEN_HERE
   
   # Or set as environment variable:
   export NGROK_AUTHTOKEN=YOUR_AUTH_TOKEN_HERE
   \`\`\`

2. **Start development with tunnel**:
   \`\`\`bash
   # Option 1: Start dev server and tunnel together
   pnpm run dev:tunnel
   
   # Option 2: Start tunnel separately
   pnpm run tunnel
   \`\`\`

3. **Get your webhook URL**:
   The tunnel script will display your webhook URL:
   \`\`\`
   🪝 Webhook URL: https://abc123.ngrok-free.app/api/replicate-webhook
   \`\`\`

4. **Use in Replicate**:
   Copy the webhook URL and use it in your Replicate model training or prediction calls.

## Architecture Overview

**Simplified Architecture:**
1. **Training Form** → Uploads dataset to Supabase → Submits to Replicate API
2. **Replicate** → Sends webhooks to your tunnel URL → **Webhook manages database**
3. **Status Page** → Shows real-time updates from database

The webhook automatically creates and updates database records. No manual database management needed!

## Available Scripts

- `pnpm run tunnel` - Smart tunnel with helpful output and config saving
- `pnpm run tunnel:simple` - Basic ngrok tunnel
- `pnpm run tunnel:custom` - Tunnel with custom domain (requires ngrok plan)
- `pnpm run dev:tunnel` - Start both dev server and tunnel

## Environment Variables

Make sure you have these set in your `.env.local`:

\`\`\`env
# Required for Replicate API calls  
REPLICATE_API_TOKEN=your_replicate_token_here
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Optional for persistent tunnel domains
NGROK_AUTHTOKEN=your_ngrok_auth_token_here
\`\`\`

## Webhook Testing

Your webhook endpoint is at `/api/replicate-webhook` and handles:
- ✅ **No signature verification** (optimized for internal/local use)
- ✅ **Automatic database management** (creates and updates training job records)
- ✅ **Training job status updates** (starting, processing, succeeded, failed)
- ✅ **Service role authentication** (no user session required)
- ✅ **Robust error handling** with detailed logging

### Test Your Webhook

Use the built-in testing scripts:

\`\`\`bash
# Test basic processing webhook
pnpm run test:webhook

# Test successful completion
pnpm run test:webhook:success

# Test failure scenario
pnpm run test:webhook:failed
\`\`\`

### Manual Testing

You can also test manually with curl:
\`\`\`bash
# Test processing webhook (no signature required)
curl -X POST https://your-domain.ngrok-free.app/api/replicate-webhook \
  -H "Content-Type: application/json" \
  -d '{"id":"test-123","status":"processing","logs":"Test processing"}'

# Test success webhook
curl -X POST https://your-domain.ngrok-free.app/api/replicate-webhook \
  -H "Content-Type: application/json" \
  -d '{"id":"test-456","status":"succeeded","output":"model-abc123"}'
\`\`\`

## Troubleshooting

### "authtoken required" error
1. Sign up at [ngrok.com](https://ngrok.com)
2. Get your token from [dashboard](https://dashboard.ngrok.com/get-started/your-authtoken)
3. Run: `ngrok config add-authtoken YOUR_TOKEN`

### Tunnel URL not working
- Check that your dev server is running on port 3000
- Verify the tunnel is active in ngrok dashboard
- Make sure webhook URL includes the full path: `/api/replicate-webhook`

### Webhook not receiving data
- Check that your tunnel URL is correctly set in `REPLICATE_WEBHOOK_TUNNEL_URL`
- Verify the webhook URL format: `https://your-domain.ngrok-free.app/api/replicate-webhook`
- Check server logs for error messages

## Production Deployment

For production, you don't need tunneling. Deploy your app and use your production URL:
\`\`\`
https://yourdomain.com/api/replicate-webhook
\`\`\`
