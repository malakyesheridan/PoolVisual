import { config } from 'dotenv';
config();

const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL;

if (!n8nWebhookUrl) {
  console.error('❌ N8N_WEBHOOK_URL not set in environment');
  process.exit(1);
}

console.log(`\n🧪 Testing webhook: ${n8nWebhookUrl.substring(0, 50)}...\n`);

// Create a minimal test payload
const testPayload = {
  jobId: 'test-' + Date.now(),
  tenantId: 'test-tenant',
  userId: 'test-user',
  photoId: null,
  imageUrl: 'https://example.com/test.jpg',
  compositeImageUrl: null,
  inputHash: 'test-hash',
  masks: [],
  mode: 'blend_materials',
  options: {},
  calibration: null,
  width: 1920,
  height: 1080,
  callbackUrl: 'http://localhost:3000/api/ai/enhancement/test/callback',
  callbackSecret: 'test-secret',
  provider: 'comfy:inpaint',
  model: 'sdxl'
};

async function testWebhook() {
  try {
    console.log('📤 Sending test payload...');
    console.log('Payload:', JSON.stringify(testPayload, null, 2));
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    
    const startTime = Date.now();
    const response = await fetch(n8nWebhookUrl, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'User-Agent': 'PoolVisual/1.0'
      },
      body: JSON.stringify(testPayload),
      signal: controller.signal
    }).finally(() => {
      clearTimeout(timeoutId);
    });
    
    const duration = Date.now() - startTime;
    
    console.log(`\n📥 Response received (${duration}ms):`);
    console.log(`  Status: ${response.status} ${response.statusText}`);
    console.log(`  Headers:`, Object.fromEntries(response.headers.entries()));
    
    const responseText = await response.text();
    console.log(`  Body: ${responseText.substring(0, 500)}`);
    
    if (response.ok) {
      console.log('\n✅ Webhook test successful!');
      try {
        const json = JSON.parse(responseText);
        console.log('Response JSON:', JSON.stringify(json, null, 2));
      } catch {
        // Not JSON, that's okay
      }
    } else {
      console.log('\n❌ Webhook test failed!');
      console.log(`Error: ${response.status} ${response.statusText}`);
    }
    
    process.exit(response.ok ? 0 : 1);
  } catch (error: any) {
    console.error('\n❌ Webhook test error:');
    console.error(`  Name: ${error.name}`);
    console.error(`  Message: ${error.message}`);
    console.error(`  Code: ${error.code || 'N/A'}`);
    
    if (error.name === 'AbortError') {
      console.error('\n⏱️  Request timed out after 30 seconds');
    } else if (error.code === 'ECONNREFUSED') {
      console.error('\n🔌 Connection refused - webhook URL may be incorrect or server is down');
    } else if (error.code === 'ENOTFOUND') {
      console.error('\n🌐 DNS lookup failed - webhook hostname is invalid');
    } else if (error.code === 'ECONNRESET') {
      console.error('\n🔌 Connection reset by server');
    } else if (error.code === 'ETIMEDOUT') {
      console.error('\n⏱️  Connection timed out');
    }
    
    console.error('\nFull error:', error);
    process.exit(1);
  }
}

testWebhook();

