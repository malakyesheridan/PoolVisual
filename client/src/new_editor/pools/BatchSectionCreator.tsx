/**
 * Batch Pool Section Creator
 * Creates all pool sections at once with proper metadata and z-ordering
 */

import React from 'react';
import { useMaskStore, MaskPoint } from '../../maskcore/store';
import { getCalibrationInfo, mmToPx, validateSectionWidth } from './helpers';
import { offsetPolygonInward } from '../utils';
import { offsetPolygonOutward } from './geometry';

// Generate mask ID matching BEGIN convention from maskcore/store.ts
function generateMaskId(): string {
  return `mask_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

interface PoolSectionConfig {
  enabled: boolean;
  widthMm: number;
  materialId?: string;
}

interface BatchSectionCreatorProps {
  interiorMaskId: string;
  sections: {
    waterline?: PoolSectionConfig;
    coping?: PoolSectionConfig;
    paving?: PoolSectionConfig;
  };
  onComplete?: () => void;
  onError?: (error: string) => void;
}

/**
 * Batch section creator component
 * Handles creation of multiple pool sections as a single operation
 */
export function BatchSectionCreator({
  interiorMaskId,
  sections,
  onComplete,
  onError
}: BatchSectionCreatorProps) {
  React.useEffect(() => {
    // Get fresh masks from store
    const { masks } = useMaskStore.getState();
    
    if (process.env.NODE_ENV !== 'production') {
      console.log('[BatchSectionCreator] Starting with interiorMaskId:', interiorMaskId);
      console.log('[BatchSectionCreator] Available masks:', Object.keys(masks));
    }
    
    const interiorMask = masks[interiorMaskId];
    
    if (!interiorMask) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('[BatchSectionCreator] Interior mask not found:', interiorMaskId);
      }
      onError?.('Interior mask not found');
      return;
    }
    
    if (process.env.NODE_ENV !== 'production') {
      console.log('[BatchSectionCreator] Interior mask found:', {
        id: interiorMask.id,
        name: interiorMask.name,
        isPoolSection: interiorMask.isPoolSection,
        poolSectionType: interiorMask.poolSectionType,
        parentPoolId: interiorMask.parentPoolId,
        ptsCount: interiorMask.pts?.length
      });
    }

    // Check if this is actually marked as a pool interior
    if (!interiorMask.isPoolSection || interiorMask.poolSectionType !== 'interior') {
      if (process.env.NODE_ENV !== 'production') {
        console.error('[BatchSectionCreator] Mask is not a pool interior:', {
          isPoolSection: interiorMask.isPoolSection,
          poolSectionType: interiorMask.poolSectionType
        });
      }
      onError?.('Please convert this mask to a pool interior first');
      return;
    }

    // Duplicate prevention: check if child sections already exist
    const existingChildren = Object.values(masks).filter(m => 
      m.parentPoolId === interiorMaskId && m.isPoolSection
    );
    
    if (existingChildren.length > 0) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[BatchSectionCreator] Pool already has child sections, skipping to prevent duplicates');
      }
      onComplete?.(); // Complete silently to avoid UI disruption
      return;
    }

    try {
      // Get calibration
      const calibration = getCalibrationInfo();
      
      if (!calibration.isValid && process.env.NODE_ENV !== 'production') {
        console.warn('[BatchSectionCreator] No calibration data, using fallback (100 px/m)');
      }

      // Prepare all masks to create in a single batch
      const masksToCreate: Array<{
        pts: any[];
        name: string;
        metadata: {
          isPoolSection: boolean;
          poolSectionType: 'waterline' | 'coping' | 'paving';
          parentPoolId: string;
          zIndex: number;
        };
        materialId?: string;
      }> = [];

      const interiorName = interiorMask.name || 'Pool';
      const basePoints = interiorMask.pts;

      // 1. Waterline (inward offset from interior)
      if (sections.waterline?.enabled) {
        const { widthMm, materialId } = sections.waterline;
        const validation = validateSectionWidth('waterline', widthMm);
        
        if (validation.isValid) {
          const offsetPx = mmToPx(widthMm, calibration);
          
          try {
            const waterlinePoints = offsetPolygonInward(basePoints, offsetPx) as MaskPoint[];
            
            if (waterlinePoints.length >= 3) {
              masksToCreate.push({
                pts: waterlinePoints,
                name: `${interiorName} - Waterline`,
                metadata: {
                  isPoolSection: true,
                  poolSectionType: 'waterline',
                  parentPoolId: interiorMaskId,
                  zIndex: 2
                },
                materialId
              });
            } else if (process.env.NODE_ENV !== 'production') {
              console.warn('[BatchSectionCreator] Waterline would collapse, skipping');
            }
          } catch (error) {
            if (process.env.NODE_ENV !== 'production') {
              console.error('[BatchSectionCreator] Error creating waterline:', error);
            }
          }
        } else if (process.env.NODE_ENV !== 'production') {
          console.warn('[BatchSectionCreator] Skipping waterline:', validation.error);
        }
      }

      // 2. Coping (outward offset from waterline if exists, otherwise from interior)
      if (sections.coping?.enabled) {
        const { widthMm, materialId } = sections.coping;
        const validation = validateSectionWidth('coping', widthMm);
        
        if (validation.isValid) {
          // Find base points: use waterline if it exists in our batch, otherwise use interior
          const waterlineMask = masksToCreate.find(m => m.metadata.poolSectionType === 'waterline');
          const copingBasePoints = waterlineMask ? waterlineMask.pts : basePoints;
          
          const offsetPx = mmToPx(widthMm, calibration);
          
          try {
            const copingPoints = offsetPolygonOutward(copingBasePoints, offsetPx);
            
            if (copingPoints.length >= 3) {
              masksToCreate.push({
                pts: copingPoints,
                name: `${interiorName} - Coping`,
                metadata: {
                  isPoolSection: true,
                  poolSectionType: 'coping',
                  parentPoolId: interiorMaskId,
                  zIndex: 1
                },
                materialId
              });
            } else if (process.env.NODE_ENV !== 'production') {
              console.warn('[BatchSectionCreator] Coping would collapse, skipping');
            }
          } catch (error) {
            if (process.env.NODE_ENV !== 'production') {
              console.error('[BatchSectionCreator] Error creating coping:', error);
            }
          }
        } else if (process.env.NODE_ENV !== 'production') {
          console.warn('[BatchSectionCreator] Skipping coping:', validation.error);
        }
      }

      // 3. Paving (outward offset from coping if exists, otherwise waterline, otherwise interior)
      if (sections.paving?.enabled) {
        const { widthMm, materialId } = sections.paving;
        const validation = validateSectionWidth('paving', widthMm);
        
        if (validation.isValid) {
          // Find base points: use coping if exists, otherwise waterline, otherwise interior
          const copingMask = masksToCreate.find(m => m.metadata.poolSectionType === 'coping');
          const waterlineMask = masksToCreate.find(m => m.metadata.poolSectionType === 'waterline');
          const pavingBasePoints = copingMask?.pts || waterlineMask?.pts || basePoints;
          
          const offsetPx = mmToPx(widthMm, calibration);
          
          try {
            const pavingPoints = offsetPolygonOutward(pavingBasePoints, offsetPx);
            
            if (pavingPoints.length >= 3) {
              masksToCreate.push({
                pts: pavingPoints,
                name: `${interiorName} - Paving`,
                metadata: {
                  isPoolSection: true,
                  poolSectionType: 'paving',
                  parentPoolId: interiorMaskId,
                  zIndex: 0
                },
                materialId
              });
            } else if (process.env.NODE_ENV !== 'production') {
              console.warn('[BatchSectionCreator] Paving would collapse, skipping');
            }
          } catch (error) {
            if (process.env.NODE_ENV !== 'production') {
              console.error('[BatchSectionCreator] Error creating paving:', error);
            }
          }
        } else if (process.env.NODE_ENV !== 'production') {
          console.warn('[BatchSectionCreator] Skipping paving:', validation.error);
        }
      }

      // Create all masks in a single transaction for undo/redo grouping
      if (masksToCreate.length > 0) {
        if (process.env.NODE_ENV !== 'production') {
          console.log('[BatchSectionCreator] Creating', masksToCreate.length, 'masks...');
          console.log('[BatchSectionCreator] Interior mask pts:', interiorMask.pts.length);
          console.log('[BatchSectionCreator] Calibration:', calibration);
        }
        
        const { masks: currentMasks, nextMaskOrder } = useMaskStore.getState();
        const newMasks: Record<string, any> = {};
        const now = Date.now();
        
        // Generate all IDs first
        const generatedIds = masksToCreate.map(() => generateMaskId());
        
        // Create all mask objects
        masksToCreate.forEach((mask, idx) => {
          const newId = generatedIds[idx];
          const defaultName = mask.name || `Section ${idx + 1}`;
          
          newMasks[newId] = {
            id: newId,
            pts: mask.pts,
            mode: 'area' as const,
            name: defaultName,
            isVisible: true,
            isLocked: false,
            groupId: null,
            order: nextMaskOrder + idx,
            createdAt: now,
            lastModified: now,
            color: undefined,
            notes: undefined,
            position: { x: 0, y: 0 },
            rotation: 0,
            isPoolSection: mask.metadata.isPoolSection,
            poolSectionType: mask.metadata.poolSectionType,
            parentPoolId: mask.metadata.parentPoolId,
            zIndex: mask.metadata.zIndex,
            materialId: mask.materialId,
            materialSettings: undefined
          };
        });
        
        // Commit all masks in a single transaction
        useMaskStore.setState(s => ({
          masks: {
            ...s.masks,
            ...newMasks
          },
          nextMaskOrder: nextMaskOrder + masksToCreate.length,
          selectedId: generatedIds[0] // Select first created section
        }));

        if (process.env.NODE_ENV !== 'production') {
          console.log('[BatchSectionCreator] Created', masksToCreate.length, 'pool sections');
        }

        onComplete?.();
      } else {
        onError?.('No valid sections could be created');
      }
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        const { masks: currentMasks } = useMaskStore.getState();
        console.error('[BatchSectionCreator] CAUGHT ERROR:', error);
        console.error('[BatchSectionCreator] Error stack:', error instanceof Error ? error.stack : 'No stack');
        console.error('[BatchSectionCreator] Error details:', {
          error: String(error),
          interiorMaskId,
          hasInteriorMask: !!currentMasks[interiorMaskId],
          sectionsConfig: sections,
          sectionsJSON: JSON.stringify(sections)
        });
      }
      onError?.('Failed to create pool sections');
    }
  }, [interiorMaskId, sections, onComplete, onError]); // Re-run if props change

  return null; // No UI
}

