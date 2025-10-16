const fs = require('fs');
const path = require('path');

// Create a simple canvas-based image generator
function createPlaceholderImage(width, height, color, text) {
  const canvas = require('canvas').createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Fill background
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, width, height);

  // Add border
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, width - 2, height - 2);

  // Add text
  ctx.fillStyle = '#333';
  ctx.font = `${Math.min(width, height) / 8}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, width / 2, height / 2);

  return canvas.toBuffer('image/png');
}

// Asset definitions
const assets = [
  { id: 'tree_palm_01', name: 'Palm Tree', w: 400, h: 600, color: '#4CAF50', text: '🌴' },
  { id: 'tree_oak_01', name: 'Oak Tree', w: 500, h: 700, color: '#8BC34A', text: '🌳' },
  { id: 'tree_pine_01', name: 'Pine Tree', w: 350, h: 550, color: '#2E7D32', text: '🌲' },
  { id: 'lawn_patch_01', name: 'Grass Patch', w: 300, h: 200, color: '#66BB6A', text: '🌱' },
  { id: 'decking_plank_01', name: 'Wood Decking', w: 400, h: 100, color: '#8D6E63', text: '🪵' },
  { id: 'paver_stone_01', name: 'Stone Paver', w: 200, h: 200, color: '#9E9E9E', text: '🪨' },
  { id: 'furniture_chair_01', name: 'Pool Chair', w: 150, h: 200, color: '#FF9800', text: '🪑' },
  { id: 'furniture_table_01', name: 'Outdoor Table', w: 300, h: 200, color: '#795548', text: '🪑' },
  { id: 'furniture_umbrella_01', name: 'Patio Umbrella', w: 250, h: 300, color: '#E91E63', text: '☂️' },
  { id: 'lighting_lamp_01', name: 'Garden Light', w: 100, h: 150, color: '#FFC107', text: '💡' },
  { id: 'lighting_torch_01', name: 'Tiki Torch', w: 80, h: 200, color: '#FF5722', text: '🔥' },
  { id: 'misc_fountain_01', name: 'Water Fountain', w: 200, h: 250, color: '#2196F3', text: '⛲' },
  { id: 'misc_planter_01', name: 'Garden Planter', w: 150, h: 120, color: '#4CAF50', text: '🪴' },
  { id: 'misc_statue_01', name: 'Garden Statue', w: 120, h: 180, color: '#607D8B', text: '🗿' }
];

// Ensure directories exist
const thumbsDir = path.join(__dirname, '..', 'public', 'assets', 'thumbs');
const fullDir = path.join(__dirname, '..', 'public', 'assets', 'full');

if (!fs.existsSync(thumbsDir)) {
  fs.mkdirSync(thumbsDir, { recursive: true });
}
if (!fs.existsSync(fullDir)) {
  fs.mkdirSync(fullDir, { recursive: true });
}

// Generate images
console.log('Generating placeholder assets...');

assets.forEach(asset => {
  // Generate full size image
  const fullImage = createPlaceholderImage(asset.w, asset.h, asset.color, asset.text);
  const fullPath = path.join(fullDir, `${asset.id}.png`);
  fs.writeFileSync(fullPath, fullImage);

  // Generate thumbnail (max 256px on longest edge)
  const thumbScale = Math.min(256 / asset.w, 256 / asset.h);
  const thumbW = Math.round(asset.w * thumbScale);
  const thumbH = Math.round(asset.h * thumbScale);
  const thumbImage = createPlaceholderImage(thumbW, thumbH, asset.color, asset.text);
  const thumbPath = path.join(thumbsDir, `${asset.id}.png`);
  fs.writeFileSync(thumbPath, thumbImage);

  console.log(`Generated ${asset.name}: ${asset.w}×${asset.h}px (thumb: ${thumbW}×${thumbH}px)`);
});

console.log('✅ All placeholder assets generated!');
console.log(`📁 Full images: ${fullDir}`);
console.log(`📁 Thumbnails: ${thumbsDir}`);
