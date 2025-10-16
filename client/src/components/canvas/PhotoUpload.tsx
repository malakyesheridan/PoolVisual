import React, { useRef } from "react";
import { useEditorStore } from "@/stores/editorStore";

export function PhotoUpload() {
  const inputRef = useRef<HTMLInputElement>(null);
  const loadImageFile = useEditorStore(s => s.loadImageFile);
  return (
    <>
      <button onClick={() => inputRef.current?.click()}>Upload Photo</button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (f) await loadImageFile(f);
        }}
      />
    </>
  );
}
