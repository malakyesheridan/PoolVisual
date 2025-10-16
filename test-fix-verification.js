// Test script to verify PhotoSpace fixes
// Run with: node test-fix-verification.js

const puppeteer = require('puppeteer');

async function testPhotoSpaceFix() {
  console.log('🚀 Testing PhotoSpace fix...');
  
  const browser = await puppeteer.launch({ 
    headless: false, 
    devtools: true,
    args: ['--disable-web-security']
  });
  
  const page = await browser.newPage();
  
  // Enable console log capture
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('[TRACE]') || text.includes('[READY_WITHOUT_COMMIT]') || text.includes('[EditorStore]')) {
      console.log(`📝 ${text}`);
    }
  });
  
  try {
    console.log('📱 Navigating to canvas editor...');
    await page.goto('http://localhost:5173/canvas-editor', { waitUntil: 'networkidle0' });
    
    // Wait for the page to load
    await page.waitForTimeout(2000);
    
    console.log('📸 Looking for file upload input...');
    const fileInput = await page.$('input[type="file"]');
    
    if (!fileInput) {
      console.log('❌ File input not found');
      return;
    }
    
    console.log('📁 Uploading test image...');
    // Create a test image file (portrait orientation to match the issue)
    await fileInput.uploadFile('./test-portrait.jpg');
    
    console.log('⏳ Waiting for image processing...');
    await page.waitForTimeout(3000);
    
    // Check for the dev overlay
    const overlay = await page.$('.bg-black\\/80.text-white.p-3.rounded.text-xs.font-mono');
    if (overlay) {
      const overlayText = await overlay.evaluate(el => el.textContent);
      console.log('🔍 Dev overlay content:', overlayText);
      
      // Check if PhotoSpace is properly set
      if (overlayText.includes('PhotoSpace: null')) {
        console.log('❌ FAILED: PhotoSpace is still null');
        return;
      }
      
      if (overlayText.includes('Scale: 0')) {
        console.log('❌ FAILED: Scale is still 0');
        return;
      }
      
      if (overlayText.includes('Zoom: NaN')) {
        console.log('❌ FAILED: Zoom is still NaN');
        return;
      }
      
      console.log('✅ SUCCESS: PhotoSpace is properly set');
    }
    
    // Wait a bit more to see if the issue persists
    await page.waitForTimeout(2000);
    
    console.log('✅ Test completed successfully');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await browser.close();
  }
}

// Create a test image if it doesn't exist
const fs = require('fs');
const { createCanvas } = require('canvas');

if (!fs.existsSync('./test-portrait.jpg')) {
  console.log('🎨 Creating test portrait image...');
  const canvas = createCanvas(3965, 6660);
  const ctx = canvas.getContext('2d');
  
  // Create a gradient background
  const gradient = ctx.createLinearGradient(0, 0, 0, 6660);
  gradient.addColorStop(0, '#4F46E5');
  gradient.addColorStop(1, '#EC4899');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 3965, 6660);
  
  // Add some text
  ctx.fillStyle = 'white';
  ctx.font = 'bold 48px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('Test Portrait Image', 3965/2, 6660/2);
  ctx.fillText('3965×6660', 3965/2, 6660/2 + 60);
  
  const buffer = canvas.toBuffer('image/jpeg');
  fs.writeFileSync('./test-portrait.jpg', buffer);
  console.log('✅ Test image created');
}

testPhotoSpaceFix().catch(console.error);
