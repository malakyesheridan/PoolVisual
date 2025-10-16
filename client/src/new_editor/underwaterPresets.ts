// Underwater Effect Presets
// Provides predefined underwater effect settings for quick application

import { UnderwaterRealismSettings } from './types';

export interface UnderwaterPreset {
  name: string;
  description: string;
  settings: UnderwaterRealismSettings;
}

export const UNDERWATER_PRESETS: UnderwaterPreset[] = [
  {
    name: 'Calm',
    description: 'Low intensity, low ripple, shallow bias',
    settings: {
      enabled: true,
      blend: 25,           // Low intensity
      refraction: 5,       // Low ripple
      depthBias: 15,       // Shallow bias
      tint: 10,           // Minimal tint
      highlights: 20,     // Low highlights
      edgeSoftness: 8,    // Moderate edge softness
      underwaterVersion: 'v2',
      meniscus: 20,       // Low meniscus
      softness: 0         // No softness
    }
  },
  {
    name: 'Standard',
    description: 'Balanced underwater effect with realistic defaults',
    settings: {
      enabled: true,
      blend: 45,           // Moderate intensity
      refraction: 15,      // Moderate ripple
      depthBias: 30,       // Moderate depth bias
      tint: 18,           // Moderate tint
      highlights: 35,     // Moderate highlights
      edgeSoftness: 10,    // Good edge softness
      underwaterVersion: 'v2',
      meniscus: 32,       // Standard meniscus
      softness: 0         // No softness
    }
  },
  {
    name: 'Sparkle',
    description: 'Higher highlights, mild ripple, avoid harsh artifacting',
    settings: {
      enabled: true,
      blend: 55,           // Higher intensity
      refraction: 25,      // Mild ripple
      depthBias: 40,       // Stronger depth bias
      tint: 22,           // Stronger tint
      highlights: 50,     // Higher highlights
      edgeSoftness: 12,    // Strong edge softness
      underwaterVersion: 'v2',
      meniscus: 40,       // Higher meniscus
      softness: 5         // Mild softness
    }
  }
];

export function getPresetByName(name: string): UnderwaterPreset | undefined {
  return UNDERWATER_PRESETS.find(preset => preset.name === name);
}

export function applyPresetToSettings(preset: UnderwaterPreset): UnderwaterRealismSettings {
  return { ...preset.settings };
}
