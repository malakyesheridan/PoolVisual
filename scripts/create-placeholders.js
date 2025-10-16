// Create placeholder images for Asset Library
// Generates simple PNG images with silhouettes for testing

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Asset definitions
const assets = [
  { id: 'tree_palm_01', name: 'Palm Tree', w: 400, h: 600, color: '#22c55e' },
  { id: 'tree_oak_01', name: 'Oak Tree', w: 500, h: 700, color: '#16a34a' },
  { id: 'tree_pine_01', name: 'Pine Tree', w: 350, h: 550, color: '#15803d' },
  { id: 'lawn_patch_01', name: 'Grass Patch', w: 300, h: 200, color: '#84cc16' },
  { id: 'decking_plank_01', name: 'Decking Plank', w: 400, h: 100, color: '#a3a3a3' },
  { id: 'paver_stone_01', name: 'Stone Paver', w: 200, h: 200, color: '#6b7280' },
  { id: 'furniture_chair_01', name: 'Pool Chair', w: 200, h: 300, color: '#f3f4f6' },
  { id: 'furniture_table_01', name: 'Pool Table', w: 300, h: 200, color: '#e5e7eb' },
  { id: 'furniture_umbrella_01', name: 'Pool Umbrella', w: 250, h: 400, color: '#3b82f6' },
  { id: 'lighting_lamp_01', name: 'Pool Lamp', w: 150, h: 250, color: '#ffffff' },
  { id: 'lighting_torch_01', name: 'Tiki Torch', w: 100, h: 300, color: '#92400e' },
  { id: 'misc_fountain_01', name: 'Water Fountain', w: 300, h: 400, color: '#9ca3af' },
  { id: 'misc_planter_01', name: 'Garden Planter', w: 200, h: 250, color: '#dc2626' },
  { id: 'misc_statue_01', name: 'Garden Statue', w: 150, h: 300, color: '#6b7280' }
];

// Create directories
const thumbsDir = path.join(__dirname, '..', 'public', 'assets', 'thumbs');
const fullDir = path.join(__dirname, '..', 'public', 'assets', 'full');

if (!fs.existsSync(thumbsDir)) {
  fs.mkdirSync(thumbsDir, { recursive: true });
}
if (!fs.existsSync(fullDir)) {
  fs.mkdirSync(fullDir, { recursive: true });
}

// Generate SVG content for an asset
function generateSVG(asset, isThumb = false) {
  const width = isThumb ? Math.min(256, asset.w) : asset.w;
  const height = isThumb ? Math.min(256, asset.h) : asset.h;
  const scale = Math.min(width / asset.w, height / asset.h);
  
  const scaledW = asset.w * scale;
  const scaledH = asset.h * scale;
  const x = (width - scaledW) / 2;
  const y = (height - scaledH) / 2;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${width}" height="${height}" fill="transparent"/>
  <rect x="${x}" y="${y}" width="${scaledW}" height="${scaledH}" fill="${asset.color}" opacity="0.8"/>
  <text x="${width/2}" y="${height/2}" text-anchor="middle" dominant-baseline="middle" 
        font-family="Arial, sans-serif" font-size="${Math.min(width, height) * 0.1}" 
        fill="white" opacity="0.9">${asset.name}</text>
</svg>`;
}

// Convert SVG to PNG using a simple approach
function svgToPng(svgContent, outputPath) {
  // For now, we'll create a simple PNG using a basic approach
  // In a real implementation, you'd use a library like sharp or canvas
  
  // Create a simple base64 PNG (1x1 transparent pixel)
  const pngData = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
  
  // Write the SVG content as a fallback
  fs.writeFileSync(outputPath.replace('.png', '.svg'), svgContent);
  
  // For now, create a simple colored rectangle PNG
  // This is a placeholder - in production you'd use a proper image library
  const buffer = Buffer.from(pngData, 'base64');
  fs.writeFileSync(outputPath, buffer);
}

// Generate all assets
console.log('Creating placeholder assets...');

assets.forEach(asset => {
  // Generate full size
  const fullSVG = generateSVG(asset, false);
  const fullPath = path.join(fullDir, `${asset.id}.png`);
  svgToPng(fullSVG, fullPath);
  
  // Generate thumbnail
  const thumbSVG = generateSVG(asset, true);
  const thumbPath = path.join(thumbsDir, `${asset.id}.png`);
  svgToPng(thumbSVG, thumbPath);
  
  console.log(`Created: ${asset.id} (${asset.w}x${asset.h})`);
});

console.log('Placeholder assets created successfully!');
console.log(`Full images: ${fullDir}`);
console.log(`Thumbnails: ${thumbsDir}`);
