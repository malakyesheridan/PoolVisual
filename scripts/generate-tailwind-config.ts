// scripts/generate-tailwind-config.ts
import { designTokens } from '../client/src/design-tokens/tokens';
import { writeFileSync } from 'fs';
import { join } from 'path';
import type { Config } from "tailwindcss";

function generateTailwindConfig() {
  const config = `// Auto-generated from design-tokens/tokens.ts
// DO NOT EDIT MANUALLY - Run: npm run tokens:generate

import type { Config } from "tailwindcss";
import { designTokens } from './client/src/design-tokens/tokens';

export default {
  darkMode: ["class"],
  content: ["./client/index.html", "./client/src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      spacing: ${JSON.stringify(designTokens.spacing, null, 2)},
      colors: {
        primary: ${JSON.stringify(designTokens.colors.light.primary, null, 2)},
        surface: ${JSON.stringify(designTokens.colors.light.surface, null, 2)},
        border: ${JSON.stringify(designTokens.colors.light.border, null, 2)},
      },
      boxShadow: ${JSON.stringify(designTokens.elevation, null, 2)},
      borderRadius: ${JSON.stringify(designTokens.radius, null, 2)},
      transitionDuration: ${JSON.stringify(designTokens.motion.duration, null, 2)},
      transitionTimingFunction: ${JSON.stringify(designTokens.motion.easing, null, 2)},
    },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
} satisfies Config;
`;

  writeFileSync(
    join(process.cwd(), 'tailwind.config.generated.ts'),
    config,
    'utf-8'
  );
  
  console.log('✅ Generated tailwind.config.generated.ts from design tokens');
}

generateTailwindConfig();

