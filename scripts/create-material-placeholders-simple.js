// Create simple placeholder images for materials using SVG
const fs = require('fs');
const path = require('path');

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
  { id: 'coping_marble_01', name: 'Marble Coping', category: 'coping', color: '#8B4513' },
  { id: 'waterline_tile_blue_01', name: 'Blue Waterline Tile', category: 'waterline_tile', color: '#4682B4' },
  { id: 'interior_pebble_01', name: 'Pebble Interior', category: 'interior', color: '#F5DEB3' },
  { id: 'paving_stone_01', name: 'Natural Stone Paving', category: 'paving', color: '#696969' },
  { id: 'fencing_wood_01', name: 'Wooden Fencing', category: 'fencing', color: '#228B22' },
  { id: 'coping_travertine_01', name: 'Travertine Coping', category: 'coping', color: '#D2B48C' },
  { id: 'waterline_tile_white_01', name: 'White Waterline Tile', category: 'waterline_tile', color: '#F5F5F5' },
  { id: 'interior_glass_01', name: 'Glass Interior', category: 'interior', color: '#87CEEB' }
];

function createSVG(width, height, color, name) {
  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="${width}" height="${height}" fill="${color}"/>
    <rect x="0" y="0" width="${width/2}" height="${height/2}" fill="${color}" opacity="0.7"/>
    <rect x="${width/2}" y="${height/2}" width="${width/2}" height="${height/2}" fill="${color}" opacity="0.7"/>
    <text x="${width/2}" y="${height/2 + 5}" text-anchor="middle" font-family="Arial" font-size="12" fill="white">${name}</text>
  </svg>`;
}

// Create images for each material
materials.forEach(material => {
  // Create thumbnail (64x64)
  const thumbSVG = createSVG(64, 64, material.color, material.name.split(' ')[0]);
  fs.writeFileSync(path.join(thumbsDir, `${material.id}.svg`), thumbSVG);
  
  // Create texture (256x256)
  const textureSVG = createSVG(256, 256, material.color, material.name.split(' ')[0]);
  fs.writeFileSync(path.join(texturesDir, `${material.id}.svg`), textureSVG);
  
  console.log(`Created ${material.name} (${material.category})`);
});

console.log('Material placeholders created successfully!');
