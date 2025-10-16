import React from "react";
import CanvasStage from "@/components/canvas/CanvasStage";
import { PhotoUpload } from "@/components/canvas/PhotoUpload";
import { useEditorStore } from "@/stores/editorStore";

export default function CanvasEditorPage() {
  const { bg } = useEditorStore(s => ({ bg: s.bg }));
  return (
    <div style={{ display: "flex", height: "100%", gap: 16 }}>
      <div style={{ flex: 1, minHeight: "60vh", position: "relative", background: "#f8fafc", borderRadius: 8 }}>
        <div style={{ position: "absolute", left: 12, top: 8, zIndex: 7, display: "flex", gap: 8 }}>
          <PhotoUpload />
        </div>
        <CanvasStage />
      </div>
      <aside style={{ width: 320 }}>
        <div style={{ padding: 12, border: "1px solid #e5e7eb", borderRadius: 8 }}>
          <div><strong>Editor Panel</strong></div>
          <div style={{ fontSize: 12, color: "#475569", marginTop: 4 }}>BgState: {bg.state}</div>
          <div style={{ fontSize: 12, color: "#475569" }}>Image: {bg.naturalW}×{bg.naturalH}</div>
          <div style={{ marginTop: 12, fontSize: 12, color: "#64748b" }}>
            Shortcuts: <code>A</code> area, <code>V</code> select, <code>Space</code> pan, <code>Ctrl/Cmd+0</code> fit, <code>Enter/Esc</code> commit/cancel
          </div>
        </div>
      </aside>
    </div>
  );
}