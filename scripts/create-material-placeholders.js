// Create placeholder images for materials
const fs = require('fs');
const path = require('path');
const { createCanvas } = require('canvas');

// Create directories if they don't exist
const thumbsDir = path.join(__dirname, '..', 'public', 'materials', 'thumbs');
const texturesDir = path.join(__dirname, '..', 'public', 'materials', 'textures');

if (!fs.existsSync(thumbsDir)) {
  fs.mkdirSync(thumbsDir, { recursive: true });
}
if (!fs.existsSync(texturesDir)) {
  fs.mkdirSync(texturesDir, { recursive: true });
}

// Material definitions
const materials = [
  { id: 'coping_marble_01', name: 'Marble Coping', category: 'coping', color: '#8B4513', pattern: 'marble' },
  { id: 'waterline_tile_blue_01', name: 'Blue Waterline Tile', category: 'waterline_tile', color: '#4682B4', pattern: 'tile' },
  { id: 'interior_pebble_01', name: 'Pebble Interior', category: 'interior', color: '#F5DEB3', pattern: 'pebble' },
  { id: 'paving_stone_01', name: 'Natural Stone Paving', category: 'paving', color: '#696969', pattern: 'stone' },
  { id: 'fencing_wood_01', name: 'Wooden Fencing', category: 'fencing', color: '#228B22', pattern: 'wood' },
  { id: 'coping_travertine_01', name: 'Travertine Coping', category: 'coping', color: '#D2B48C', pattern: 'travertine' },
  { id: 'waterline_tile_white_01', name: 'White Waterline Tile', category: 'waterline_tile', color: '#F5F5F5', pattern: 'tile' },
  { id: 'interior_glass_01', name: 'Glass Interior', category: 'interior', color: '#87CEEB', pattern: 'glass' }
];

function createPattern(ctx, pattern, color) {
  switch (pattern) {
    case 'marble':
      // Marble veining pattern
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, 256, 256);
      ctx.strokeStyle = '#654321';
      ctx.lineWidth = 2;
      for (let i = 0; i < 20; i++) {
        ctx.beginPath();
        ctx.moveTo(Math.random() * 256, Math.random() * 256);
        ctx.lineTo(Math.random() * 256, Math.random() * 256);
        ctx.stroke();
      }
      break;
    case 'tile':
      // Tile pattern
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, 256, 256);
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1;
      for (let x = 0; x < 256; x += 32) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, 256);
        ctx.stroke();
      }
      for (let y = 0; y < 256; y += 32) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(256, y);
        ctx.stroke();
      }
      break;
    case 'pebble':
      // Pebble texture
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, 256, 256);
      ctx.fillStyle = '#D2B48C';
      for (let i = 0; i < 50; i++) {
        const x = Math.random() * 256;
        const y = Math.random() * 256;
        const size = Math.random() * 20 + 5;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    case 'stone':
      // Stone texture
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, 256, 256);
      ctx.fillStyle = '#808080';
      for (let i = 0; i < 30; i++) {
        const x = Math.random() * 256;
        const y = Math.random() * 256;
        const width = Math.random() * 40 + 10;
        const height = Math.random() * 40 + 10;
        ctx.fillRect(x, y, width, height);
      }
      break;
    case 'wood':
      // Wood grain
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, 256, 256);
      ctx.strokeStyle = '#8B4513';
      ctx.lineWidth = 2;
      for (let i = 0; i < 10; i++) {
        ctx.beginPath();
        ctx.moveTo(0, i * 25);
        ctx.lineTo(256, i * 25 + Math.sin(i) * 10);
        ctx.stroke();
      }
      break;
    case 'travertine':
      // Travertine pattern
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, 256, 256);
      ctx.fillStyle = '#F5DEB3';
      for (let i = 0; i < 40; i++) {
        const x = Math.random() * 256;
        const y = Math.random() * 256;
        const size = Math.random() * 15 + 5;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    case 'glass':
      // Glass pattern
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, 256, 256);
      ctx.fillStyle = '#B0E0E6';
      ctx.fillRect(0, 0, 128, 128);
      ctx.fillRect(128, 128, 128, 128);
      break;
    default:
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, 256, 256);
  }
}

// Create images for each material
materials.forEach(material => {
  // Create thumbnail (64x64)
  const thumbCanvas = createCanvas(64, 64);
  const thumbCtx = thumbCanvas.getContext('2d');
  createPattern(thumbCtx, material.pattern, material.color);
  
  // Create texture (256x256)
  const textureCanvas = createCanvas(256, 256);
  const textureCtx = textureCanvas.getContext('2d');
  createPattern(textureCtx, material.pattern, material.color);
  
  // Save thumbnail
  const thumbBuffer = thumbCanvas.toBuffer('image/png');
  fs.writeFileSync(path.join(thumbsDir, `${material.id}.png`), thumbBuffer);
  
  // Save texture
  const textureBuffer = textureCanvas.toBuffer('image/png');
  fs.writeFileSync(path.join(texturesDir, `${material.id}.png`), textureBuffer);
  
  console.log(`Created ${material.name} (${material.category})`);
});

console.log('Material placeholders created successfully!');
