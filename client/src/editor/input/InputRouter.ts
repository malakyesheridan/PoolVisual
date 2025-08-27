/**
 * Input Router - Central event dispatcher for all canvas tools
 * Ensures only the active tool consumes events, preventing tool conflicts
 */

import type { KonvaEventObject } from 'konva/lib/Node';
import type { Stage } from 'konva/lib/Stage';

export interface ToolController {
  name: 'calibration' | 'area' | 'linear' | 'waterline' | 'eraser' | 'hand';
  onPointerDown(pt: { x: number; y: number }, e: KonvaEventObject<any>): boolean;
  onPointerMove(pt: { x: number; y: number }, e: KonvaEventObject<any>): boolean;
  onPointerUp(pt: { x: number; y: number }, e: KonvaEventObject<any>): boolean;
  onCancel?(): void;
  onKey?(code: string, e: KeyboardEvent): boolean;
  getCursor?(): string;
}

export type ToolName = ToolController['name'];

export class InputRouter {
  constructor(
    private getActive: () => ToolName,
    private controllers: Record<ToolName, ToolController>,
    private store: any
  ) {}

  handleDown(stage: Stage, e: KonvaEventObject<any>) {
    const pt = getStagePoint(stage);
    if (!pt) return;

    const tool = this.controllers[this.getActive()];
    if (tool?.onPointerDown(pt, e)) {
      e.cancelBubble = true;
    }
  }

  handleMove(stage: Stage, e: KonvaEventObject<any>) {
    const pt = getStagePoint(stage);
    if (!pt) return;

    const tool = this.controllers[this.getActive()];
    if (tool?.onPointerMove(pt, e)) {
      e.cancelBubble = true;
    }
  }

  handleUp(stage: Stage, e: KonvaEventObject<any>) {
    const pt = getStagePoint(stage);
    if (!pt) return;

    const tool = this.controllers[this.getActive()];
    if (tool?.onPointerUp(pt, e)) {
      e.cancelBubble = true;
    }
  }

  handleKey(code: string, e: KeyboardEvent): boolean {
    const tool = this.controllers[this.getActive()];
    return tool?.onKey?.(code, e) || false;
  }

  getCursor(): string {
    const tool = this.controllers[this.getActive()];
    return tool?.getCursor?.() || 'default';
  }
}

export function getStagePoint(stage: Stage): { x: number; y: number } | null {
  const p = stage.getPointerPosition();
  if (!p) return null;
  const t = stage.getAbsoluteTransform().copy().invert();
  return t.point(p);
}