import React from "react";
import { useEditorStore } from "@/stores/editorStore";

export function DebugOverlay() {
  const { containerW, containerH, bg, photo } = useEditorStore(s => ({
    containerW: s.containerW, containerH: s.containerH, bg: s.bg, photo: s.photo
  }));
  const ps = photo.space;
  return (
    <div style={{
      position: "absolute", top: 8, left: 8, padding: "6px 8px",
      background: "rgba(0,0,0,0.7)", color: "#fff", fontSize: 11, borderRadius: 6, lineHeight: 1.25,
      pointerEvents: "none", zIndex: 5
    }}>
      <div>Container: {containerW}×{containerH}</div>
      <div>Image: {bg.naturalW}×{bg.naturalH}</div>
      <div>PhotoSpace: {ps ? "ok" : "null"}</div>
      <div>Scale: {ps ? ps.scale.toFixed(3) : 0}</div>
      <div>Pan: {ps ? `${ps.panX.toFixed(1)}, ${ps.panY.toFixed(1)}` : "0,0"}</div>
      <div>BgState: {bg.state}</div>
    </div>
  );
}
