#!/usr/bin/env node

const ngrok = require('ngrok');
const fs = require('fs');
const path = require('path');

async function setupTunnel() {
  try {
    console.log('🔌 Starting ngrok tunnel...');
    
    // Connect to ngrok
    const options = {
      addr: 3000,
      authtoken_from_env: true, // Uses NGROK_AUTHTOKEN env var if available
    };
    
    // Check if a custom domain is specified via environment variable
    const customDomain = process.env.NGROK_DOMAIN;
    if (customDomain) {
      options.hostname = customDomain;
      console.log(`🎯 Using custom domain: ${customDomain}`);
    }
    
    const url = await ngrok.connect(options);
    
    const webhookUrl = `${url}/api/replicate-webhook`;
    
    console.log('\n✅ Tunnel established!');
    console.log('🌐 Public URL:', url);
    console.log('🪝 Webhook URL:', webhookUrl);
    console.log('\n📋 Copy this webhook URL to your Replicate model/training configuration:');
    console.log(`   ${webhookUrl}`);
    
    // Optionally save to a local file for easy access
    const configPath = path.join(process.cwd(), '.tunnel-config.json');
    const config = {
      tunnelUrl: url,
      webhookUrl: webhookUrl,
      timestamp: new Date().toISOString()
    };
    
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log(`\n💾 Configuration saved to: ${configPath}`);
    
    console.log('\n🛑 Press Ctrl+C to stop the tunnel');
    
    // Keep the process alive
    process.on('SIGINT', async () => {
      console.log('\n🔌 Disconnecting tunnel...');
      await ngrok.disconnect();
      await ngrok.kill();
      
      // Clean up config file
      if (fs.existsSync(configPath)) {
        fs.unlinkSync(configPath);
      }
      
      console.log('👋 Tunnel disconnected. Goodbye!');
      process.exit(0);
    });
    
    // Keep alive
    await new Promise(() => {});
    
  } catch (error) {
    console.error('❌ Error setting up tunnel:', error.message);
    
    if (error.message.includes('authtoken')) {
      console.log('\n💡 To use ngrok:');
      console.log('1. Sign up at https://ngrok.com');
      console.log('2. Get your auth token from https://dashboard.ngrok.com/get-started/your-authtoken');
      console.log('3. Set it as an environment variable: export NGROK_AUTHTOKEN=your_token_here');
      console.log('4. Or run: ngrok config add-authtoken your_token_here');
    }
    
    process.exit(1);
  }
}

// Check if running directly
if (require.main === module) {
  setupTunnel();
}

module.exports = { setupTunnel }; 