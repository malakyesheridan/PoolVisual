import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createCanvas } from 'canvas';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const outputDir = path.resolve(__dirname, '../public/templates/previews');

// Ensure directory exists
fs.mkdirSync(outputDir, { recursive: true });

const templates = [
  { id: 'rectangular_standard', name: 'Standard Rectangular Pool', category: 'rectangular', color: '#4A90E2' },
  { id: 'freeform_natural', name: 'Natural Freeform Pool', category: 'freeform', color: '#7ED321' },
  { id: 'spa_luxury', name: 'Luxury Spa Pool', category: 'spa', color: '#F5A623' },
];

console.log('Creating template previews...');

templates.forEach(template => {
  const canvas = createCanvas(200, 150);
  const ctx = canvas.getContext('2d');
  
  // Background
  ctx.fillStyle = '#F8F9FA';
  ctx.fillRect(0, 0, 200, 150);
  
  // Template shape based on category
  ctx.fillStyle = template.color;
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 2;
  
  if (template.category === 'rectangular') {
    // Rectangular pool
    ctx.fillRect(30, 40, 140, 80);
    ctx.strokeRect(30, 40, 140, 80);
  } else if (template.category === 'freeform') {
    // Freeform pool
    ctx.beginPath();
    ctx.moveTo(50, 60);
    ctx.bezierCurveTo(80, 40, 120, 40, 150, 60);
    ctx.bezierCurveTo(170, 80, 170, 100, 150, 120);
    ctx.bezierCurveTo(120, 140, 80, 140, 50, 120);
    ctx.bezierCurveTo(30, 100, 30, 80, 50, 60);
    ctx.fill();
    ctx.stroke();
  } else if (template.category === 'spa') {
    // Small spa
    ctx.beginPath();
    ctx.arc(100, 75, 40, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();
  }
  
  // Title
  ctx.fillStyle = '#333';
  ctx.font = '12px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(template.name, 100, 130);
  
  // Save
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(path.join(outputDir, `${template.id}.png`), buffer);
  
  console.log(`Created: ${template.id}.png`);
});

console.log('Template previews created successfully!');
console.log('Output directory:', outputDir);
