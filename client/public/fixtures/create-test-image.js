// Create a test portrait image for testing
const canvas = document.createElement('canvas');
canvas.width = 600;
canvas.height = 800; // Portrait orientation

const ctx = canvas.getContext('2d')!;

// Background
ctx.fillStyle = '#87CEEB';
ctx.fillRect(0, 0, 600, 800);

// Pool shape
ctx.fillStyle = '#006994';
ctx.beginPath();
ctx.ellipse(300, 400, 200, 150, 0, 0, 2 * Math.PI);
ctx.fill();

// Pool tiles
ctx.fillStyle = '#4a90e2';
ctx.globalAlpha = 0.3;
ctx.fillRect(150, 300, 300, 200);
ctx.globalAlpha = 1;

// Pool deck
ctx.fillStyle = '#8B4513';
ctx.fillRect(0, 0, 600, 100);
ctx.fillRect(0, 700, 600, 100);
ctx.fillRect(0, 0, 100, 800);
ctx.fillRect(500, 0, 100, 800);

// Text
ctx.fillStyle = 'white';
ctx.font = 'bold 24px Arial';
ctx.textAlign = 'center';
ctx.fillText('Test Pool Image', 300, 50);
ctx.font = '16px Arial';
ctx.fillText('Portrait Test (600×800)', 300, 450);

// Convert to data URL
const dataUrl = canvas.toDataURL('image/png');

// This would be saved as a file, but for now we'll use it directly
console.log('Test image data URL:', dataUrl);
