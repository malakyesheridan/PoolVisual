import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as PIXI from 'pixi.js';
import { useEditor } from './store';

// Fallback implementation if @pixi/react is not available
// This creates a basic PixiJS stage manually
export function EditorStage(){
  const { doc, dispatch } = useEditor();
  const [container, setContainer] = useState<DOMRect>();
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const appRef = useRef<PIXI.Application>();
  
  // Loop prevention refs
  const lastFitKey = useRef<string>('');
  const wheelLock = useRef(false);
  const panning = useRef(false);
  const last = useRef<{x:number,y:number}|null>(null);

  useEffect(()=> {
    const ro = new ResizeObserver(([entry])=>{
      setContainer(entry.contentRect);
      if (doc.status==='ready' && appRef.current && appRef.current.renderer) {
        try {
          appRef.current.renderer.resize(entry.contentRect.width, entry.contentRect.height);
        } catch (error) {
          console.error('[Editor v2] Failed to resize renderer:', error);
        }
      }
    });
    if (hostRef.current) ro.observe(hostRef.current);
    return ()=> ro.disconnect();
  }, [doc.status]);

  // Edge-triggered fit effect
  useEffect(()=>{
    if (!container || doc.status!=='ready') return;
    const key = `${Math.round(container.width)}x${Math.round(container.height)}|${doc.view.imgW}x${doc.view.imgH}`;
    if (key === lastFitKey.current) return;             // 🔒 no-op if nothing truly changed
    lastFitKey.current = key;
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Editor v2] Resize effect triggered: ${key}`);
    }
    dispatch({type:'view/fit', containerW: container.width, containerH: container.height});
  }, [container?.width, container?.height, doc.status, doc.view.imgW, doc.view.imgH, dispatch]);

  // Initialize PixiJS app
  useEffect(() => {
    if (!hostRef.current || appRef.current) return;
    
    try {
      // Create a canvas element first
      const canvas = document.createElement('canvas');
      canvas.width = container?.width ?? 800;
      canvas.height = container?.height ?? 600;
      
      const app = new PIXI.Application({
        view: canvas,
        width: container?.width ?? 800,
        height: container?.height ?? 600,
        backgroundColor: 0x000000,
        backgroundAlpha: 0,
        antialias: true,
        resolution: window.devicePixelRatio || 1,
      });
      
      hostRef.current.appendChild(canvas);
      appRef.current = app;
      
      return () => {
        if (appRef.current) {
          appRef.current.destroy(true);
          appRef.current = undefined;
        }
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[Editor v2] Failed to initialize PIXI.Application:', error);
      setPixiError(errorMessage);
    }
  }, [container]);

  // Update scene when doc changes
  useEffect(() => {
    if (!appRef.current || !appRef.current.stage) return;
    
    try {
      const app = appRef.current;
      app.stage.removeChildren();
      
      // Create main container with view transform
      const mainContainer = new PIXI.Container();
      mainContainer.scale.set(doc.view.scale);
      mainContainer.position.set(doc.view.panX, doc.view.panY);
      app.stage.addChild(mainContainer);
      
      // Background sprite
      if (doc.bg.url && doc.bg.w && doc.bg.h) {
        const texture = PIXI.Texture.from(doc.bg.url);
        const bgSprite = new PIXI.Sprite(texture);
        bgSprite.width = doc.view.imgW;
        bgSprite.height = doc.view.imgH;
        mainContainer.addChild(bgSprite);
      }
      
      // Render masks
      Object.values(doc.masks).forEach(mask => {
        if (mask.type !== 'area' || mask.points.length < 6) return;
        
        const maskContainer = new PIXI.Container();
        maskContainer.eventMode = 'static';
        maskContainer.on('pointertap', () => dispatch({type:'select', id:mask.id}));
        
        // Create graphics for mask outline
        const graphics = new PIXI.Graphics();
        const isSelected = mask.id === doc.selectedId;
        graphics.lineStyle(2, isSelected ? 0x00AEEF : 0xffffff, 1);
        graphics.beginFill(0xffffff, 0.0001); // tiny alpha for hit area
        graphics.moveTo(mask.points[0], mask.points[1]);
        for (let i = 2; i < mask.points.length; i += 2) {
          graphics.lineTo(mask.points[i], mask.points[i + 1]);
        }
        graphics.closePath();
        graphics.endFill();
        
        // Add material texture if assigned
        if (mask.materialId && doc.materials[mask.materialId]) {
          const material = doc.materials[mask.materialId];
          const texture = PIXI.Texture.from(material.url);
          const tilingSprite = new PIXI.TilingSprite(texture, doc.view.imgW, doc.view.imgH);
          tilingSprite.mask = graphics;
          maskContainer.addChild(tilingSprite);
        }
        
        maskContainer.addChild(graphics);
        mainContainer.addChild(maskContainer);
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[Editor v2] Failed to update scene:', error);
      setPixiError(errorMessage);
    }
    
  }, [doc.bg.url, doc.bg.w, doc.bg.h, doc.view.scale, doc.view.panX, doc.view.panY, doc.view.imgW, doc.view.imgH, doc.masks, doc.selectedId, doc.materials, dispatch]);

  // Handle wheel events for zoom (throttled)
  useEffect(() => {
    if (!hostRef.current) return;
    
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (wheelLock.current) return;
      wheelLock.current = true;
      const rect = hostRef.current!.getBoundingClientRect();
      const cx = e.clientX - rect.left, cy = e.clientY - rect.top, dy = e.deltaY;
      requestAnimationFrame(()=>{
        dispatch({type:'view/zoom', cx, cy, delta: dy});
        wheelLock.current = false;
      });
    };
    
    hostRef.current.addEventListener('wheel', handleWheel);
    return () => hostRef.current?.removeEventListener('wheel', handleWheel);
  }, [dispatch]);

  // Handle pointer events for pan and drawing (panning only while mouse down)
  useEffect(() => {
    if (!hostRef.current) return;
    
    const handlePointerDown = (e: PointerEvent) => {
      if (e.button === 1 || (e.button === 0 && e.shiftKey) || doc.mode === 'pan') {
        panning.current = true;
        last.current = {x: e.clientX, y: e.clientY};
      } else if (e.button === 0 && doc.mode === 'draw-area') {
        // Left click in draw mode
        const rect = hostRef.current!.getBoundingClientRect();
        const x = (e.clientX - rect.left - doc.view.panX) / doc.view.scale;
        const y = (e.clientY - rect.top - doc.view.panY) / doc.view.scale;
        
        if (!doc.selectedId) {
          dispatch({type: 'mask/start-area', at: [x, y]});
        } else {
          dispatch({type: 'mask/add-point', at: [x, y]});
        }
      }
    };
    
    const handlePointerMove = (e: PointerEvent) => {
      if (!panning.current || !last.current) return;
      const dx = e.clientX - last.current.x;
      const dy = e.clientY - last.current.y;
      if (dx !== 0 || dy !== 0) {
        dispatch({type: 'view/pan', dx, dy});
      }
      last.current = {x: e.clientX, y: e.clientY};
    };
    
    const handlePointerUp = () => {
      panning.current = false;
      last.current = null;
    };
    
    hostRef.current.addEventListener('pointerdown', handlePointerDown);
    hostRef.current.addEventListener('pointermove', handlePointerMove);
    hostRef.current.addEventListener('pointerup', handlePointerUp);
    
    return () => {
      hostRef.current?.removeEventListener('pointerdown', handlePointerDown);
      hostRef.current?.removeEventListener('pointermove', handlePointerMove);
      hostRef.current?.removeEventListener('pointerup', handlePointerUp);
    };
  }, [doc.mode, doc.selectedId, doc.view.panX, doc.view.panY, doc.view.scale, dispatch]);

  const scalePct = Number.isFinite(doc.view.scale) ? Math.round(doc.view.scale*100) : 100;
  const [pixiError, setPixiError] = useState<string | null>(null);

  return (
    <div ref={hostRef} data-editor-stage style={{position:'relative', height:'calc(100vh - 120px)'}}>
      <div style={{position:'absolute', right:12, bottom:8, fontSize:12, opacity:0.8}}>{scalePct}%</div>
      
      {pixiError && (
        <div style={{
          position: 'absolute', 
          top: '50%', 
          left: '50%', 
          transform: 'translate(-50%, -50%)',
          fontSize: 16,
          color: '#ff4444',
          backgroundColor: 'rgba(0,0,0,0.8)',
          padding: '20px',
          borderRadius: 8,
          textAlign: 'center'
        }}>
          <div>PixiJS Initialization Error</div>
          <div style={{fontSize: 12, marginTop: 8}}>{pixiError}</div>
          <button 
            onClick={() => window.location.reload()} 
            style={{
              marginTop: 12,
              padding: '8px 16px',
              backgroundColor: '#00AEEF',
              color: 'white',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer'
            }}
          >
            Reload Page
          </button>
        </div>
      )}
      
      {doc.status === 'loading' && !pixiError && (
        <div style={{
          position: 'absolute', 
          top: '50%', 
          left: '50%', 
          transform: 'translate(-50%, -50%)',
          fontSize: 16,
          color: '#666'
        }}>
          Loading...
        </div>
      )}
      {doc.status === 'ready' && !pixiError && (
        <div style={{
          position: 'absolute', 
          top: 8, 
          left: 8,
          fontSize: 12,
          color: '#00AEEF',
          backgroundColor: 'rgba(0,0,0,0.7)',
          padding: '4px 8px',
          borderRadius: 4
        }}>
          Ready
        </div>
      )}
    </div>
  );
}
