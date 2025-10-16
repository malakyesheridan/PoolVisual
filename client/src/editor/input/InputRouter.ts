/**
 * Input Router - Reliable, Testable Implementation
 * Only calibration active states consume events
 */

import type Konva from 'konva';
import { screenToImg } from '@/render/photoTransform';

export const isCalActive = (s:any)=> s.calState==='placingA' || s.calState==='placingB' || s.calState==='lengthEntry';

export class InputRouter {
  constructor(private store:any){}
  
  private getActive(): 'calibration'|'area'|'linear'|'waterline'|'eraser'|'hand' {
    const s=this.store.getState();
    return isCalActive(s) ? 'calibration' : s.activeTool;
  }
  
  private pt(stage:Konva.Stage){ 
    const p=stage.getPointerPosition(); 
    if(!p) return null; 
    
    // Get the photo transform from the store
    const s = this.store.getState();
    if (!s.photoSpace) return null;
    
    // Convert screen coordinates to image coordinates
    const T = {
      S: s.photoSpace.scale,
      originX: s.photoSpace.panX + (s.containerSize.width - s.photoSpace.imgW * s.photoSpace.scale) / 2,
      originY: s.photoSpace.panY + (s.containerSize.height - s.photoSpace.imgH * s.photoSpace.scale) / 2
    };
    
    return screenToImg(T, p.x, p.y);
  }
  
  handleDown(stage:Konva.Stage,e:any){ 
    const pt=this.pt(stage); 
    if(!pt) return;
    const s=this.store.getState(); 
    const tool=this.getActive();
    
    if(tool==='calibration'){ 
      this.store.getState().placeCalPoint(pt); 
      e.cancelBubble=true; 
      return; 
    }
    if(tool==='hand'){ 
      /* stage dragging handles */ 
      return; 
    }
    if(tool==='area'||tool==='linear'||tool==='waterline'){ 
      this.store.getState().startPath(tool,pt); 
      e.cancelBubble=true; 
      return; 
    }
    if(tool==='eraser'){ 
      /* optional */ 
    }
  }
  
  handleMove(stage:Konva.Stage,e:any){ 
    const pt=this.pt(stage); 
    if(!pt) return;
    const s=this.store.getState(); 
    const tool=this.getActive();
    
    if(tool==='calibration' && s.calState==='placingB'){ 
      this.store.getState().updateCalPreview(pt); 
      e.cancelBubble=true; 
      return; 
    }
    if(s.transient){ 
      this.store.getState().appendPoint(pt); 
      e.cancelBubble=true; 
      return; 
    }
  }
  
  handleUp(stage:Konva.Stage,e:any){ 
    /* noop for now */ 
  }
}