import { config } from 'dotenv';
config();

const baseUrl = 'https://easyflowai.app.n8n.cloud';
const testUrl = `${baseUrl}/webhook-test/enhancement`;
const prodUrl = `${baseUrl}/webhook/enhancement`;

const testPayload = {
  jobId: 'test-' + Date.now(),
  tenantId: 'test-tenant',
  mode: 'blend_materials',
  imageUrl: 'https://example.com/test.jpg'
};

async function testWebhook(url: string, name: string) {
  try {
    console.log(`\n🧪 Testing ${name}: ${url}\n`);
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testPayload),
      signal: AbortSignal.timeout(10000)
    });
    
    console.log(`  Status: ${response.status} ${response.statusText}`);
    const text = await response.text();
    console.log(`  Response: ${text.substring(0, 200)}`);
    
    if (response.ok) {
      console.log(`  ✅ ${name} is WORKING!`);
      return true;
    } else {
      console.log(`  ❌ ${name} returned ${response.status}`);
      return false;
    }
  } catch (error: any) {
    console.log(`  ❌ ${name} error: ${error.message}`);
    return false;
  }
}

(async () => {
  console.log('🔍 Testing both webhook URLs...\n');
  
  const testResult = await testWebhook(testUrl, 'TEST webhook (/webhook-test/enhancement)');
  const prodResult = await testWebhook(prodUrl, 'PRODUCTION webhook (/webhook/enhancement)');
  
  console.log('\n📊 Results:');
  console.log(`  Test URL: ${testResult ? '✅ WORKING' : '❌ NOT WORKING'}`);
  console.log(`  Prod URL: ${prodResult ? '✅ WORKING' : '❌ NOT WORKING'}`);
  
  if (!testResult && !prodResult) {
    console.log('\n⚠️  Both URLs failed. Check:');
    console.log('  1. Is the n8n workflow activated?');
    console.log('  2. Is the webhook node named "enhancement"?');
    console.log('  3. Has the webhook URL changed?');
  } else if (prodResult && !testResult) {
    console.log('\n💡 Use PRODUCTION URL in your .env:');
    console.log(`   N8N_WEBHOOK_URL=${prodUrl}`);
  }
  
  process.exit(0);
})();

