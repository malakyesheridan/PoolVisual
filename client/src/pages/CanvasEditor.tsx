/**
 * Canvas Editor Page - Simplified working version
 * Core functionality: Load photo, zoom/pan, draw masks, apply materials
 */

import React, { useEffect, useRef, useState } from 'react';
import { Stage, Layer, Group, Line, Image as KonvaImage, Shape } from 'react-konva';
import useImage from 'use-image';
import { toast } from '@/hooks/use-toast';

interface PhotoSpace {
  scale: number;
  panX: number;
  panY: number;
  imgW: number;
  imgH: number;
}

interface AreaMask {
  id: string;
  points: number[];
  closed: boolean;
  materialId?: string;
}

interface Material {
  id: string;
  name: string;
  texture_url?: string;
}

export default function CanvasEditor() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoSpace, setPhotoSpace] = useState<PhotoSpace | null>(null);
  const [masks, setMasks] = useState<AreaMask[]>([]);
  const [selectedMaskId, setSelectedMaskId] = useState<string | null>(null);
  const [drawing, setDrawing] = useState<{ active: boolean; points: number[] } | null>(null);
  const [tool, setTool] = useState<'pan' | 'area' | 'select'>('pan');
  const [panning, setPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number } | null>(null);
  const [history, setHistory] = useState<{ past: AreaMask[][]; future: AreaMask[][] }>({ past: [], future: [] });

  // Demo materials
  const [materials] = useState<Material[]>([
    { id: '1', name: 'Blue Tile', texture_url: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjU2IiBoZWlnaHQ9IjI1NiIgdmlld0JveD0iMCAwIDI1NiAyNTYiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyNTYiIGhlaWdodD0iMjU2IiBmaWxsPSIjMjU2M2ViIi8+CjxyZWN0IHg9IjAiIHk9IjAiIHdpZHRoPSI2NCIgaGVpZ2h0PSI2NCIgZmlsbD0iIzFiOWZmIi8+CjxyZWN0IHg9IjY0IiB5PSI2NCIgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiBmaWxsPSIjMWI5ZmYiLz4KPHJlY3QgeD0iMTI4IiB5PSIwIiB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIGZpbGw9IiMxYjlmZiIvPgo8cmVjdCB4PSIxOTIiIHk9IjY0IiB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIGZpbGw9IiMxYjlmZiIvPgo8L3N2Zz4K' },
    { id: '2', name: 'Stone Pavers', texture_url: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjU2IiBoZWlnaHQ9IjI1NiIgdmlld0JveD0iMCAwIDI1NiAyNTYiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyNTYiIGhlaWdodD0iMjU2IiBmaWxsPSIjNzc3MzY5Ii8+CjxyZWN0IHg9IjAiIHk9IjAiIHdpZHRoPSI2NCIgaGVpZ2h0PSI2NCIgZmlsbD0iIzg4ODQ3YSIvPgo8cmVjdCB4PSI2NCIgeT0iNjQiIHdpZHRoPSI2NCIgaGVpZ2h0PSI2NCIgZmlsbD0iIzg4ODQ3YSIvPgo8cmVjdCB4PSIxMjgiIHk9IjAiIHdpZHRoPSI2NCIgaGVpZ2h0PSI2NCIgZmlsbD0iIzg4ODQ3YSIvPgo8cmVjdCB4PSIxOTIiIHk9IjY0IiB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIGZpbGw9IiM4ODg0N2EiLz4KPC9zdmc+Cg==' },
    { id: '3', name: 'Wood Decking', texture_url: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjU2IiBoZWlnaHQ9IjI1NiIgdmlld0JveD0iMCAwIDI1NiAyNTYiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyNTYiIGhlaWdodD0iMjU2IiBmaWxsPSIjOTY1MDAzIi8+CjxyZWN0IHg9IjAiIHk9IjAiIHdpZHRoPSIyNTYiIGhlaWdodD0iMzIiIGZpbGw9IiNhNjY0MDAiLz4KPHJlY3QgeD0iMCIgeT0iMzIiIHdpZHRoPSIyNTYiIGhlaWdodD0iMzIiIGZpbGw9IiM5NjUwMDMiLz4KPHJlY3QgeD0iMCIgeT0iNjQiIHdpZHRoPSIyNTYiIGhlaWdodD0iMzIiIGZpbGw9IiNhNjY0MDAiLz4KPHJlY3QgeD0iMCIgeT0iOTYiIHdpZHRoPSIyNTYiIGhlaWdodD0iMzIiIGZpbGw9IiM5NjUwMDMiLz4KPHJlY3QgeD0iMCIgeT0iMTI4IiB3aWR0aD0iMjU2IiBoZWlnaHQ9IjMyIiBmaWxsPSIjYTY2NDAwIi8+CjxyZWN0IHg9IjAiIHk9IjE2MCIgd2lkdGg9IjI1NiIgaGVpZ2h0PSIzMiIgZmlsbD0iIzk2NTAwMyIvPgo8cmVjdCB4PSIwIiB5PSIxOTIiIHdpZHRoPSIyNTYiIGhlaWdodD0iMzIiIGZpbGw9IiNhNjY0MDAiLz4KPHJlY3QgeD0iMCIgeT0iMjI0IiB3aWR0aD0iMjU2IiBoZWlnaHQ9IjMyIiBmaWxsPSIjOTY1MDAzIi8+Cjwvc3ZnPgo=' },
  ]);

  // Load image
  const [imageEl] = useImage(photoUrl || '', 'anonymous');

  // Update dimensions when container resizes
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions({
          width: rect.width,
          height: rect.height
        });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Initialize photo space when image loads
  useEffect(() => {
    if (imageEl && dimensions.width > 0 && dimensions.height > 0) {
      // Always start at 100% zoom for calibration compatibility
      const scale = 1.0;
      const panX = (dimensions.width - imageEl.naturalWidth * scale) / 2;
      const panY = (dimensions.height - imageEl.naturalHeight * scale) / 2;
      
      setPhotoSpace({
        scale,
        panX,
        panY,
        imgW: imageEl.naturalWidth,
        imgH: imageEl.naturalHeight,
      });
    }
  }, [imageEl, dimensions]);

  // Handle file upload
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setPhotoUrl(url);
      toast({
        title: "Image Loaded",
        description: "Your image has been loaded successfully.",
      });
    }
  };

  // Handle wheel zoom
  const handleWheel = (e: any) => {
    if (!photoSpace) return;
    e.evt.preventDefault();
    const stage = e.target.getStage();
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const zoomFactor = Math.exp(-e.evt.deltaY * 0.001);
    const newScale = Math.max(0.1, Math.min(5, photoSpace.scale * zoomFactor));

    const ix = (pointer.x - photoSpace.panX) / photoSpace.scale;
    const iy = (pointer.y - photoSpace.panY) / photoSpace.scale;

    const panX = pointer.x - ix * newScale;
    const panY = pointer.y - iy * newScale;

    setPhotoSpace({
      ...photoSpace,
      scale: newScale,
      panX,
      panY,
    });
  };

  // Extract mask ID from target node by walking up parent chain
  const getMaskIdFromTarget = (target: any): string | null => {
    let current = target;
    while (current) {
      const maskId = current.getAttr && current.getAttr('maskId');
      if (maskId) return maskId;
      current = current.getParent();
    }
    return null;
  };

  // Handle mouse events with centralized mask selection
  const handleMouseDown = (e: any) => {
    if (!photoSpace) return;
    const stage = e.target.getStage();
    const target = e.target;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    // Debug instrumentation (temporary)
    console.log('[CanvasEditor]', target.getClassName(), target.name());

    // Phase 1: Check if this is a mask click (highest priority)
    const maskId = getMaskIdFromTarget(target);
    if (maskId) {
      console.log('[CanvasEditor MaskSelect]', { maskId });
      setSelectedMaskId(maskId);
      return; // Exit early - mask selection handled
    }

    // Phase 2: If not a mask click, deselect
    console.log('[CanvasEditor MaskDeselect]', { reason: 'background-click' });
    setSelectedMaskId(null);

    if (panning || tool === 'pan') {
      setPanStart(pointer);
      return;
    }

    if (tool === 'area') {
      const ix = (pointer.x - photoSpace.panX) / photoSpace.scale;
      const iy = (pointer.y - photoSpace.panY) / photoSpace.scale;
      setDrawing({ active: true, points: [ix, iy] });
    }
  };

  const handleMouseMove = (e: any) => {
    if (!photoSpace) return;
    const pointer = e.target.getStage().getPointerPosition();
    if (!pointer) return;

    if (panning || tool === 'pan') {
      if (panStart) {
        const dx = pointer.x - panStart.x;
        const dy = pointer.y - panStart.y;
        setPhotoSpace({
          ...photoSpace,
          panX: photoSpace.panX + dx,
          panY: photoSpace.panY + dy,
        });
        setPanStart(pointer);
      }
      return;
    }

    if (drawing?.active) {
      const ix = (pointer.x - photoSpace.panX) / photoSpace.scale;
      const iy = (pointer.y - photoSpace.panY) / photoSpace.scale;
      setDrawing({ active: true, points: [...drawing.points, ix, iy] });
    }
  };

  const handleMouseUp = () => {
    setPanStart(null);
  };


  // Keyboard handlers
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Guard: Don't trigger shortcuts when typing in inputs
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable || target.getAttribute('role') === 'textbox') {
        return;
      }
      
      if (e.key === 'Enter' && drawing?.active) {
        if (drawing.points.length >= 6) {
          const mask: AreaMask = {
            id: crypto.randomUUID(),
            points: drawing.points,
            closed: true,
          };
          pushHistory(masks);
          setMasks([...masks, mask]);
          setSelectedMaskId(mask.id);
        }
        setDrawing(null);
        setTool('select');
      }
      if (e.key === 'Escape' && drawing?.active) {
        setDrawing(null);
        setTool('select');
      }
      if (e.key === 'a' && !drawing) {
        setTool('area');
        setDrawing({ active: true, points: [] });
      }
      if (e.key === 'v') {
        setTool('select');
        setDrawing(null);
      }
      if (e.key === ' ') {
        e.preventDefault();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        redo();
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === ' ') setPanning(true);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === ' ') setPanning(false);
    };

    window.addEventListener('keydown', onKey);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [drawing, masks]);

  // Fit to screen
  const fitToScreen = () => {
    if (!imageEl || !dimensions.width || !dimensions.height) return;
    const scale = Math.min(dimensions.width / imageEl.naturalWidth, dimensions.height / imageEl.naturalHeight) * 0.9;
    const panX = (dimensions.width - imageEl.naturalWidth * scale) / 2;
    const panY = (dimensions.height - imageEl.naturalHeight * scale) / 2;
    setPhotoSpace({
      scale,
      panX,
      panY,
      imgW: imageEl.naturalWidth,
      imgH: imageEl.naturalHeight,
    });
  };

  // Push to history
  const pushHistory = (newMasks: AreaMask[]) => {
    setHistory(prev => ({
      past: [...prev.past, masks],
      future: []
    }));
  };

  // Undo
  const undo = () => {
    if (history.past.length === 0) return;
    const newPast = [...history.past];
    const lastState = newPast.pop();
    if (!lastState) return;
    setHistory({
      past: newPast,
      future: [masks, ...history.future]
    });
    setMasks(lastState);
    setSelectedMaskId(null);
  };

  // Redo
  const redo = () => {
    if (history.future.length === 0) return;
    const [nextState, ...newFuture] = history.future;
    if (!nextState) return;
    setHistory({
      past: [...history.past, masks],
      future: newFuture
    });
    setMasks(nextState);
    setSelectedMaskId(null);
  };

  // Apply material to selected mask
  const applyMaterial = (materialId: string) => {
    if (!selectedMaskId) return;
    pushHistory(masks);
    setMasks(masks.map(mask => 
      mask.id === selectedMaskId 
        ? { ...mask, materialId } 
        : mask
    ));
    toast({
      title: "Material Applied",
      description: "Material has been applied to the selected area.",
    });
  };

  // Export composite
  const exportComposite = () => {
    toast({
      title: "Export Started",
      description: "Your image is being prepared for download",
    });
    // TODO: Implement actual export
  };

  return (
    <div className="h-screen flex flex-col bg-slate-50">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-4 bg-white border-b">
        <div className="flex items-center gap-4">
          <input
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            className="hidden"
            id="photo-upload"
          />
          <label htmlFor="photo-upload" className="px-4 py-2 bg-blue-500 text-white rounded cursor-pointer hover:bg-blue-600">
            Upload Photo
          </label>
          
          <button onClick={fitToScreen} className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600">
            Fit to Screen
          </button>
          
          <button onClick={exportComposite} className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600">
            Export
          </button>
          
          <button onClick={undo} disabled={history.past.length === 0} className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:opacity-50">
            Undo
          </button>
          
          <button onClick={redo} disabled={history.future.length === 0} className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:opacity-50">
            Redo
          </button>
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setTool('pan')} 
            className={`px-3 py-1 rounded ${tool === 'pan' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
          >
            Pan
          </button>
          <button 
            onClick={() => setTool('area')} 
            className={`px-3 py-1 rounded ${tool === 'area' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
          >
            Area
          </button>
          <button 
            onClick={() => setTool('select')} 
            className={`px-3 py-1 rounded ${tool === 'select' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
          >
            Select
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Canvas Area */}
        <div 
          ref={containerRef}
          className="flex-1 relative bg-slate-100 overflow-hidden"
        >
          {photoSpace && (
            <Stage 
              width={dimensions.width} 
              height={dimensions.height}
              onWheel={handleWheel}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
            >
              <Layer>
                <Group 
                  x={photoSpace.panX} 
                  y={photoSpace.panY} 
                  scaleX={photoSpace.scale} 
                  scaleY={photoSpace.scale}
                >
                  {/* Background image */}
                  {imageEl && (
                    <KonvaImage 
                      image={imageEl} 
                      x={0} 
                      y={0} 
                      width={photoSpace.imgW} 
                      height={photoSpace.imgH} 
                    />
                  )}

                  {/* Existing masks */}
                  {masks.map(mask => {
                    const material = materials.find(m => m.id === mask.materialId);
                    return (
                      <React.Fragment key={mask.id}>
                        {/* Textured fill */}
                        {material && (
                          <KonvaImage
                            image={new Image()}
                            x={Math.min(...mask.points.filter((_, i) => i % 2 === 0))}
                            y={Math.min(...mask.points.filter((_, i) => i % 2 === 1))}
                            width={Math.max(...mask.points.filter((_, i) => i % 2 === 0)) - Math.min(...mask.points.filter((_, i) => i % 2 === 0))}
                            height={Math.max(...mask.points.filter((_, i) => i % 2 === 1)) - Math.min(...mask.points.filter((_, i) => i % 2 === 1))}
                            opacity={0.8}
                            listening={false}
                          />
                        )}
                        {/* Mask outline - toggle visibility without killing hit testing */}
                        <Group
                          name="mask-shape"
                          listening={true}
                          isMask={true} // custom attr
                          maskId={mask.id} // for centralized handler
                        >
                          {/* Invisible hit area covering entire mask */}
                          <Shape
                            sceneFunc={(context, shape) => {
                              context.beginPath();
                              context.moveTo(mask.points[0] || 0, mask.points[1] || 0);
                              for (let i = 2; i < mask.points.length; i += 2) {
                                context.lineTo(mask.points[i] || 0, mask.points[i + 1] || 0);
                              }
                              context.closePath();
                              context.fillStrokeShape(shape);
                            }}
                            fill="rgba(0,0,0,0)" // completely transparent
                            stroke="rgba(0,0,0,0)" // completely transparent
                            listening={true}
                            maskId={mask.id} // for centralized handler
                          />
                          {/* Visible outline with fill */}
                          <Line
                            points={mask.points}
                            closed={mask.closed}
                            stroke={mask.id === selectedMaskId ? '#2563eb' : 'rgba(0,0,0,0)'}
                            strokeWidth={mask.id === selectedMaskId ? 1.5 / photoSpace.scale : 0}
                            lineCap="round"
                            lineJoin="round"
                            fill={mask.materialId ? 'rgba(37, 99, 235, 0.1)' : 'rgba(16, 185, 129, 0.1)'}
                            listening={false} // let the hit area handle clicks
                            perfectDrawEnabled={false}
                          />
                        </Group>
                      </React.Fragment>
                    );
                  })}

                  {/* Drawing in progress */}
                  {drawing?.active && drawing.points.length >= 2 && (
                    <Line
                      points={drawing.points}
                      closed={false}
                      stroke="#38bdf8"
                      strokeWidth={2 / photoSpace.scale}
                      dash={[6 / photoSpace.scale, 6 / photoSpace.scale]}
                      lineCap="round"
                      lineJoin="round"
                    />
                  )}
                </Group>
              </Layer>
            </Stage>
          )}

          {/* Debug overlay */}
          {photoSpace && (
            <div className="absolute top-4 left-4 bg-black bg-opacity-70 text-white p-2 rounded text-sm">
              <div>Scale: {Math.round(photoSpace.scale * 100)}%</div>
              <div>Pan: {Math.round(photoSpace.panX)}, {Math.round(photoSpace.panY)}</div>
              <div>Tool: {tool}</div>
              <div>Masks: {masks.length}</div>
            </div>
          )}

          {/* Zoom label */}
          {photoSpace && (
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-50 text-white px-3 py-1 rounded">
              {Math.round(photoSpace.scale * 100)}%
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="w-80 bg-white border-l p-4">
          <h3 className="font-semibold mb-4">Materials</h3>
          <div className="space-y-2">
            {materials.map(material => (
              <button
                key={material.id}
                onClick={() => applyMaterial(material.id)}
                disabled={!selectedMaskId}
                className={`w-full p-3 text-left rounded border ${
                  selectedMaskId 
                    ? 'hover:bg-blue-50 border-blue-200' 
                    : 'bg-gray-100 border-gray-200 text-gray-500'
                }`}
              >
                {material.name}
              </button>
            ))}
          </div>
          
          {selectedMaskId && (
            <div className="mt-4 p-3 bg-blue-50 rounded">
              <p className="text-sm text-blue-700">
                Selected mask: {selectedMaskId.slice(0, 8)}...
              </p>
            </div>
          )}
          
          <div className="mt-6 text-xs text-gray-500">
            <p><strong>Shortcuts:</strong></p>
            <p>A - Start area drawing</p>
            <p>V - Select tool</p>
            <p>Space - Pan mode</p>
            <p>Enter - Commit area</p>
            <p>Esc - Cancel drawing</p>
          </div>
        </div>
      </div>
    </div>
  );
}