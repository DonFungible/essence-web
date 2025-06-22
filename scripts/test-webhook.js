#!/usr/bin/env node

// Configuration
const WEBHOOK_URL = process.env.WEBHOOK_URL || 'https://lark-humorous-globally.ngrok-free.app/api/replicate-webhook';

async function testWebhook(testCase = 'processing') {
  // Use same job ID to test duplicate prevention
  const duplicateTestJobId = 'test-duplicate-prevention-12345';
  
  const testPayloads = {
    starting: {
      id: duplicateTestJobId,
      status: 'starting',
      logs: 'Model training is starting...',
      created_at: new Date().toISOString()
    },
    processing: {
      id: duplicateTestJobId,
      status: 'processing',
      logs: 'Model is training... 25% complete',
      started_at: new Date().toISOString()
    },
    succeeded: {
      id: duplicateTestJobId,
      status: 'succeeded',
      output: 'ffaf718d-a58d-4426-b128-39dc939af6fe',
      logs: 'Fine-tuning completed in 787.2sec\nFine tuning completed. Use your finetune ID ffaf718d-a58d-4426-b128-39dc939af6fe to create images with your training.',
      completed_at: new Date().toISOString(),
      started_at: new Date(Date.now() - 800000).toISOString(),
      input: {
        captioning: 'automatic',
        input_images: 'https://scnlhgunuavsfiqiomjw.supabase.co/storage/v1/object/public/models/public/TESTMODEL-f47947bd-4210-48cd-a3f8-cad8ab6161eb.zip',
        trigger_word: 'TESTMODEL',
        steps: 300
      },
      metrics: {
        predict_time: 791.272920881,
        total_time: 791.282155
      }
    },
    failed: {
      id: 'test-failed-789',
      status: 'failed',
      error: 'Training failed due to insufficient data',
      logs: 'Error: Training stopped at 15%',
      completed_at: new Date().toISOString()
    },
    lifecycle: async () => {
      console.log('🔄 Testing complete webhook lifecycle (starting → processing → succeeded)');
      console.log(`📋 Job ID: ${duplicateTestJobId}\n`);
      
      await testSingleWebhook('starting', testPayloads.starting);
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      await testSingleWebhook('processing', testPayloads.processing);
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      await testSingleWebhook('succeeded', testPayloads.succeeded);
      
      console.log(`\n✅ Lifecycle test completed!`);
      console.log(`💡 Check database - should be only ONE record with ID: ${duplicateTestJobId}`);
      return;
    }
  };

  // Handle special lifecycle test
  if (testCase === 'lifecycle' && typeof testPayloads.lifecycle === 'function') {
    await testPayloads.lifecycle();
    return;
  }

  const payload = testPayloads[testCase] || testPayloads.processing;
  await testSingleWebhook(testCase, payload);
}

async function testSingleWebhook(testCase, payload) {
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
const validTestCases = ['starting', 'processing', 'succeeded', 'failed', 'lifecycle'];

if (!validTestCases.includes(testCase)) {
  console.log(`Usage: node scripts/test-webhook.js [${validTestCases.join('|')}]`);
  console.log(`\nAvailable test cases:`);
  console.log(`  starting   - Test initial job creation`);
  console.log(`  processing - Test a job in progress`);
  console.log(`  succeeded  - Test a successful completion`);
  console.log(`  failed     - Test a failed job`);
  console.log(`  lifecycle  - Test complete start→process→success flow (duplicate prevention)`);
  process.exit(1);
}

console.log(`🚀 Starting webhook test...`);
testWebhook(testCase); 