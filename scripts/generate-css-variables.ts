// scripts/generate-css-variables.ts
import { designTokens } from '../client/src/design-tokens/tokens';
import { writeFileSync } from 'fs';
import { join } from 'path';

export function generateCSSVariables() {
  const lightVars: string[] = [];
  const darkVars: string[] = [];
  
  // Generate :root variables (light mode)
  lightVars.push(':root {');
  lightVars.push(`  /* Spacing */`);
  for (const [key, value] of Object.entries(designTokens.spacing)) {
    lightVars.push(`  --spacing-${key}: ${value};`);
  }
  
  lightVars.push(`  /* Colors - Light */`);
  for (const [key, value] of Object.entries(designTokens.colors.light.primary)) {
    lightVars.push(`  --primary-${key.toLowerCase()}: ${value};`);
  }
  for (const [key, value] of Object.entries(designTokens.colors.light.surface)) {
    lightVars.push(`  --surface-${key}: ${value};`);
  }
  for (const [key, value] of Object.entries(designTokens.colors.light.border)) {
    lightVars.push(`  --border-${key.toLowerCase()}: ${value};`);
  }
  
  lightVars.push(`  /* Elevation */`);
  for (const [key, value] of Object.entries(designTokens.elevation)) {
    lightVars.push(`  --elevation-${key}: ${value};`);
  }
  
  lightVars.push(`  /* Radius */`);
  for (const [key, value] of Object.entries(designTokens.radius)) {
    lightVars.push(`  --radius-${key}: ${value};`);
  }
  
  lightVars.push('}');
  
  // Generate .dark variables
  darkVars.push('.dark {');
  darkVars.push(`  /* Colors - Dark */`);
  for (const [key, value] of Object.entries(designTokens.colors.dark.primary)) {
    darkVars.push(`  --primary-${key.toLowerCase()}: ${value};`);
  }
  for (const [key, value] of Object.entries(designTokens.colors.dark.surface)) {
    darkVars.push(`  --surface-${key}: ${value};`);
  }
  for (const [key, value] of Object.entries(designTokens.colors.dark.border)) {
    darkVars.push(`  --border-${key.toLowerCase()}: ${value};`);
  }
  
  // High-contrast variants under same variable set
  if (designTokens.colors.highContrast) {
    darkVars.push(`  /* High Contrast - Dark (same var names) */`);
    for (const [key, value] of Object.entries(designTokens.colors.highContrast.dark)) {
      darkVars.push(`  --surface-${key}: ${value};`);
    }
  }
  
  darkVars.push('}');
  
  const output = [
    '/* Auto-generated from design-tokens/tokens.ts */',
    '/* DO NOT EDIT MANUALLY - Run: npm run tokens:generate-css */',
    '',
    ...lightVars,
    '',
    ...darkVars,
  ].join('\n');
  
  writeFileSync(
    join(process.cwd(), 'client/src/styles/tokens.css'),
    output,
    'utf-8'
  );
  
  console.log('✅ Generated CSS variables from design tokens');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  generateCSSVariables();
}

