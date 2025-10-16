/**
 * Canvas Stage - Final Behavior Spec Implementation
 * Auto Smart Blend, simplified UI, robust error handling
 */

import React, { useEffect, useRef, useState } from "react";
import { Stage, Layer, Group, Line, Image as KonvaImage } from "react-konva";
import useImage from "use-image";
import { useMeasure } from "@/hooks/useMeasure";
import { useEditorStore } from "@/stores/editorStore";
import { DebugOverlay } from "./DebugOverlay";

export default function CanvasStage() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const { w: cw, h: ch } = useMeasure(wrapRef);

  const {
    setContainerSize, bg, photo, tool, masks, drawing, setPan, setZoomAtPoint,
    addPoint, commitArea, cancelDrawing, startArea, fitToScreen, setTool, selectMask
  } = useEditorStore(s => ({
    setContainerSize: s.setContainerSize, bg: s.bg, photo: s.photo, tool: s.tool,
    masks: s.masks, drawing: s.drawing, setPan: s.setPan, setZoomAtPoint: s.setZoomAtPoint,
    addPoint: s.addPoint, commitArea: s.commitArea, cancelDrawing: s.cancelDrawing, startArea: s.startArea,
    fitToScreen: s.fitToScreen, setTool: s.setTool, selectMask: s.selectMask
  }));

  useEffect(() => {
    setContainerSize(cw, ch);
  }, [cw, ch, setContainerSize]);

  const [imageEl] = useImage(bg.url ?? "", "anonymous");

  // keyboard handlers
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" && drawing?.active) commitArea();
      if (e.key === "Escape" && drawing?.active) cancelDrawing();
      if (e.key === "0" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); fitToScreen(); }
      if (e.key === "a" && !drawing) startArea();
      if (e.key === "v") setTool("select");
      if (e.key === " ") e.preventDefault();
    };
    window.addEventListener("keydown", onKey, { passive: false });
    return () => window.removeEventListener("keydown", onKey);
  }, [drawing, commitArea, cancelDrawing, fitToScreen, startArea, setTool]);

  const [panning, setPanning] = useState(false);
  useEffect(() => {
    const down = (e: KeyboardEvent) => { if (e.key === " ") setPanning(true); };
    const up   = (e: KeyboardEvent) => { if (e.key === " ") setPanning(false); };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, []);

  const ps = photo.space;

  const handleWheel = (e: any) => {
    if (!ps) return;
    e.evt.preventDefault();
    const stage = e.target.getStage();
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    setZoomAtPoint(e.evt.deltaY, pointer.x, pointer.y);
  };

  const handleMouseDown = (e: any) => {
    if (!ps) return;
    const pointer = e.target.getStage().getPointerPosition();
    if (!pointer) return;
    if (panning || tool === "pan") {
      (e.target.getStage() as any).__panning = pointer;
      return;
    }
    if (tool === "area") {
      addPoint(pointer.x, pointer.y);
    }
  };

  const handleMouseMove = (e: any) => {
    if (!ps) return;
    if (panning || tool === "pan") {
      const st = e.target.getStage() as any;
      const p0 = st.__panning;
      if (!p0) return;
      const p1 = st.getPointerPosition();
      if (!p1) return;
      setPan(p1.x - p0.x, p1.y - p0.y);
      st.__panning = p1;
    }
  };

  const handleMouseUp = (e: any) => {
    if (!ps) return;
    const st = e.target.getStage() as any;
    if (st.__panning) st.__panning = null;
  };

  return (
    <div ref={wrapRef} style={{ position: "relative", height: "calc(100vh - 140px)" }}>
      <DebugOverlay />
      <Stage width={cw} height={ch}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        listening={true}
      >
        <Layer listening={true}>
          {ps && (
            <Group x={ps.panX} y={ps.panY} scaleX={ps.scale} scaleY={ps.scale} listening={true}>
              {/* Background image */}
              {imageEl && <KonvaImage image={imageEl} x={0} y={0} width={ps.imgW} height={ps.imgH} listening={false} />}

              {/* Existing masks */}
              {masks.map(m => (
                <Line key={m.id}
                  points={m.points}
                  closed={m.closed}
                  stroke="#2dd4bf"
                  strokeWidth={2 / ps.scale}
                  lineCap="round"
                  lineJoin="round"
                  fill="rgba(45,212,191,0.12)"
                  onClick={() => selectMask(m.id)}
                  listening={true}
                />
              ))}

              {/* Drawing in progress */}
              {drawing?.active && drawing.points.length >= 2 && (
                <Line
                  points={drawing.points}
                  closed={false}
                  stroke="#38bdf8"
                  strokeWidth={2 / ps.scale}
                  dash={[6 / ps.scale, 6 / ps.scale]}
                  lineCap="round"
                  lineJoin="round"
                  listening={false}
                />
              )}
            </Group>
          )}
        </Layer>
      </Stage>
      {/* Simple toolbar */}
      <div style={{ position: "absolute", left: 12, top: 8 + 90, display: "flex", gap: 8, zIndex: 6 }}>
        <button onClick={() => useEditorStore.getState().fitToScreen()}>Fit</button>
        <button onClick={() => useEditorStore.getState().setTool("pan")}>Pan</button>
        <button onClick={() => useEditorStore.getState().startArea()}>Area</button>
        <button onClick={() => useEditorStore.getState().undo()}>Undo</button>
        <button onClick={() => useEditorStore.getState().redo()}>Redo</button>
      </div>
      {/* Zoom label */}
      <div style={{ position: "absolute", bottom: 8, left: "50%", transform: "translateX(-50%)", background: "rgba(0,0,0,0.5)", color:"#fff", padding:"4px 8px", borderRadius:6 }}>
        {ps && Number.isFinite(ps.scale) ? `${Math.round(ps.scale * 100)}%` : "100%"}
      </div>
    </div>
  );
}