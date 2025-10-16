import React from "react";
import PhotoToolbar from "./PhotoToolbar";
import PhotoPreview from "./PhotoPreview";
import PhotoErrorBoundary from "./PhotoErrorBoundary";
import { TransformProvider } from "./context/TransformContext";
import ProjectBar from "./ProjectBar";
import AlignmentOverlay from "./AlignmentOverlay";
import CornerCalibrateWrapper from "./CornerCalibrateWrapper";
import { useAutoSyncFromCanvas } from "./hooks/useAutoSyncFromCanvas";

export default function PhotoTabContainer({ isActive }: { isActive: boolean }) {
  // Auto-sync canvas to photo when photo tab becomes active
  const { syncing } = useAutoSyncFromCanvas(isActive);

  return (
    <TransformProvider>
      <div className="flex flex-col h-full">
        <PhotoToolbar />
        <div className="flex-1 relative">
          <PhotoErrorBoundary>
            <PhotoPreview />
          </PhotoErrorBoundary>
          <AlignmentOverlay />
          <ProjectBar />
          <CornerCalibrateWrapper />
        </div>
      </div>
    </TransformProvider>
  );
}
