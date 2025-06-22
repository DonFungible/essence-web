#!/usr/bin/env node

// Configuration
const WEBHOOK_URL = process.env.WEBHOOK_URL || 'https://lark-humorous-globally.ngrok-free.app/api/replicate-webhook';

async function testWebhook(testCase = 'processing') {
  const testPayloads = {
    processing: {
      id: 'test-processing-123',
      status: 'processing',
      logs: 'Model is training... 25% complete'
    },
    succeeded: {
      id: 'test-success-456',
      status: 'succeeded',
      output: 'replicate-model-id-abc123',
      logs: 'Training completed successfully!'
    },
    failed: {
      id: 'test-failed-789',
      status: 'failed',
      error: 'Training failed due to insufficient data',
      logs: 'Error: Training stopped at 15%'
    }
  };

  const payload = testPayloads[testCase] || testPayloads.processing;
  const payloadString = JSON.stringify(payload);

  console.log(`🧪 Testing webhook with "${testCase}" payload...`);
  console.log(`📍 URL: ${WEBHOOK_URL}`);
  console.log(`📦 Payload:`, payload);
  console.log(`🔓 No signature required (internal use)`);

  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: payloadString
    });

    const responseText = await response.text();
    
    console.log(`\n📊 Response:`);
    console.log(`Status: ${response.status} ${response.statusText}`);
    console.log(`Body:`, responseText);

    if (response.ok) {
      console.log(`✅ Webhook test "${testCase}" passed!`);
    } else {
      console.log(`❌ Webhook test "${testCase}" failed!`);
    }

  } catch (error) {
    console.error(`💥 Error testing webhook:`, error.message);
  }
}

// CLI usage
const testCase = process.argv[2] || 'processing';
const validTestCases = ['processing', 'succeeded', 'failed'];

if (!validTestCases.includes(testCase)) {
  console.log(`Usage: node scripts/test-webhook.js [${validTestCases.join('|')}]`);
  console.log(`\nAvailable test cases:`);
  console.log(`  processing - Test a job in progress`);
  console.log(`  succeeded  - Test a successful completion`);
  console.log(`  failed     - Test a failed job`);
  process.exit(1);
}

console.log(`🚀 Starting webhook test...`);
testWebhook(testCase); 