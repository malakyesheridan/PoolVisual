// Pool Template Library Data
// Contains the pool template items for drag-drop functionality

import { PoolTemplateLibraryItem } from './types';

export const POOL_TEMPLATE_LIBRARY: PoolTemplateLibraryItem[] = [
  {
    id: 'rect-standard',
    name: 'Rectangular Pool',
    type: 'rect',
    thumbnail: '/assets/pools/rect-standard-thumb.png',
    description: 'Standard rectangular pool with rounded corners',
    defaultBands: { waterlinePx: 60, copingPx: 120 },
    defaultFrame: { w: 800, h: 400 }
  },
  {
    id: 'rect-lap',
    name: 'Lap Pool',
    type: 'lap',
    thumbnail: '/assets/pools/rect-lap-thumb.png',
    description: 'Long narrow pool for swimming laps',
    defaultBands: { waterlinePx: 50, copingPx: 100 },
    defaultFrame: { w: 1200, h: 300 }
  },
  {
    id: 'kidney-classic',
    name: 'Kidney Pool',
    type: 'kidney',
    thumbnail: '/assets/pools/kidney-classic-thumb.png',
    description: 'Classic kidney-shaped pool with organic curves',
    defaultBands: { waterlinePx: 80, copingPx: 150 },
    defaultFrame: { w: 600, h: 400 }
  },
  {
    id: 'freeform-organic',
    name: 'Freeform Pool A',
    type: 'freeform',
    thumbnail: '/assets/pools/freeform-organic-thumb.png',
    description: 'Organic freeform pool with natural curves',
    defaultBands: { waterlinePx: 70, copingPx: 140 },
    defaultFrame: { w: 700, h: 500 }
  },
  {
    id: 'freeform-modern',
    name: 'Freeform Pool B',
    type: 'freeform',
    thumbnail: '/assets/pools/freeform-modern-thumb.png',
    description: 'Modern freeform pool with geometric elements',
    defaultBands: { waterlinePx: 65, copingPx: 130 },
    defaultFrame: { w: 650, h: 450 }
  }
];

export function getPoolTemplateById(id: string): PoolTemplateLibraryItem | undefined {
  return POOL_TEMPLATE_LIBRARY.find(template => template.id === id);
}

export function getPoolTemplatesByType(type: string): PoolTemplateLibraryItem[] {
  if (type === 'All') {
    return POOL_TEMPLATE_LIBRARY;
  }
  return POOL_TEMPLATE_LIBRARY.filter(template => template.type === type);
}
